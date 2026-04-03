import os
import boto3
import requests
import uuid
from dotenv import load_dotenv
from botocore.exceptions import ClientError
from scrapy.exceptions import DropItem, CloseSpider
from decimal import Decimal

load_dotenv()

EMBED_API_URL = os.getenv("EMBED_API_URL", "http://localhost:8000/embed/url")
S3_BUCKET     = os.getenv("S3_BUCKET_NAME")
AWS_REGION    = os.getenv("AWS_REGION", "ap-southeast-2")

class FashionPipeline:
    def open_spider(self, spider):
        spider.logger.info(f"ENV CHECK — S3_BUCKET_NAME: {os.getenv('S3_BUCKET_NAME')}")
        spider.logger.info(f"ENV CHECK — SCRAPER_DYNAMODB_TABLE: {os.getenv('SCRAPER_DYNAMODB_TABLE')}")
        spider.logger.info(f"ENV CHECK — EMBED_API_URL: {EMBED_API_URL}")
        spider.logger.info(f"ENV CHECK — AWS_REGION: {AWS_REGION}")

        if not S3_BUCKET:
            raise CloseSpider("MISSING ENV: S3_BUCKET_NAME is not set")
        if not os.getenv("AWS_ACCESS_KEY_ID"):
            raise CloseSpider("MISSING ENV: AWS_ACCESS_KEY_ID is not set")
        if not os.getenv("AWS_SECRET_ACCESS_KEY"):
            raise CloseSpider("MISSING ENV: AWS_SECRET_ACCESS_KEY is not set")

        try:
            self.s3 = boto3.client(
                "s3",
                region_name=AWS_REGION,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
        except Exception as e:
            raise CloseSpider(f"S3 CLIENT ERROR: {e}")

        try:
            self.dynamo = boto3.resource(
                "dynamodb",
                region_name=AWS_REGION,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
            self.table = self.dynamo.Table(os.getenv("SCRAPER_DYNAMODB_TABLE", "scraped_products"))
        except Exception as e:
            raise CloseSpider(f"DYNAMODB CLIENT ERROR: {e}")

        spider.logger.info(f"Pipeline ready — S3: {S3_BUCKET} | DynamoDB: {self.table.name}")

    def clean_image_url(self, url):
        if not url:
            return None
        if url.startswith("data:"):
            return None
        if url.startswith("//"):
            return "https:" + url
        if not url.startswith("http"):
            return None
        return url

    def process_item(self, item, spider):
        image_url = item.get("image_url")
        product_id = item.get("sku") or str(uuid.uuid4())
        title = item.get("title", "unknown")

        # --- Validate item ---
        if not image_url:
            raise DropItem(f"[{product_id}] No image_url — skipping")

        if not item.get("title"):
            raise DropItem(f"[{product_id}] No title — skipping")

        # --- 1. Duplicate check ---
        try:
            result = self.table.get_item(Key={"product_id": product_id})
            if "Item" in result:
                spider.logger.info(f"[DUPLICATE] Skipping: {title} ({product_id})")
                raise DropItem(f"Duplicate: {product_id}")
        except DropItem:
            raise
        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg = e.response["Error"]["Message"]
            raise CloseSpider(f"DYNAMODB ERROR during lookup [{code}]: {msg}")
        except Exception as e:
            raise CloseSpider(f"UNEXPECTED ERROR during DynamoDB lookup: {e}")

        # --- 2. Upload all images to S3 ---
        s3_urls = []
        first_key = None  # track actual first successfully uploaded key

        for i, img_url in enumerate(item.get("images", [image_url])):
            clean_url = self.clean_image_url(img_url)
            if not clean_url:
                spider.logger.debug(f"[S3] Skipping invalid URL for image {i}: {str(img_url)[:60]}")
                continue
            try:
                r = requests.get(clean_url, timeout=10)
                r.raise_for_status()
                key = f"scraped/{item.get('retailer')}/{product_id}/image_{i}.jpg"
                self.s3.put_object(
                    Bucket=S3_BUCKET,
                    Key=key,
                    Body=r.content,
                    ContentType=r.headers.get("Content-Type", "image/jpeg"),
                )
                s3_urls.append(f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}")
                if first_key is None:
                    first_key = key  # save the first successful key
                spider.logger.debug(f"[S3] Uploaded image {i} for {product_id}")
            except requests.HTTPError as e:
                spider.logger.warning(f"[S3] HTTP {e.response.status_code} downloading image {i} for {product_id}: {e}")
            except ClientError as e:
                code = e.response["Error"]["Code"]
                msg = e.response["Error"]["Message"]
                raise CloseSpider(f"S3 UPLOAD ERROR [{code}]: {msg}")
            except Exception as e:
                spider.logger.warning(f"[S3] Failed image {i} for {product_id}: {type(e).__name__}: {e}")

        if not s3_urls:
            raise DropItem(f"[{product_id}] All image uploads failed — skipping")

        # --- 3. Generate presigned URL using actual first uploaded key ---
        try:
            presigned_url = self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": first_key},
                ExpiresIn=300
            )
            spider.logger.info(f"[PRESIGN] Generated URL for key: {first_key}")
        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg = e.response["Error"]["Message"]
            raise CloseSpider(f"PRESIGNED URL ERROR [{code}]: {msg}")
        except Exception as e:
            raise CloseSpider(f"UNEXPECTED ERROR generating presigned URL: {e}")

        # --- 4. Generate embedding ---
        try:
            spider.logger.info(f"[EMBED] Calling embed worker for {product_id}")
            embed_res = requests.post(
                EMBED_API_URL,
                params={"image_url": presigned_url},
                timeout=30
            )
            embed_res.raise_for_status()
            embed_data = embed_res.json()
            vector = embed_data["vector"]
            dim    = embed_data["dim"]
            spider.logger.info(f"[EMBED] Success — dim={dim} for {product_id}")
        except requests.ConnectionError:
            raise CloseSpider(f"EMBED WORKER ERROR: Cannot connect to {EMBED_API_URL} — is the embed worker running?")
        except requests.HTTPError as e:
            raise CloseSpider(f"EMBED WORKER ERROR: HTTP {e.response.status_code} — {e.response.text}")
        except requests.Timeout:
            raise CloseSpider(f"EMBED WORKER ERROR: Timed out connecting to {EMBED_API_URL}")
        except KeyError as e:
            raise CloseSpider(f"EMBED WORKER ERROR: Missing key in response {e} — response was: {embed_res.text}")
        except Exception as e:
            raise CloseSpider(f"EMBED WORKER UNEXPECTED ERROR: {type(e).__name__}: {e}")

        # --- 5. Save to DynamoDB ---
        try:
            self.table.put_item(
                Item={
                    "product_id":  product_id,
                    "title":       item.get("title", ""),
                    "brand":       item.get("brand", ""),
                    "gender":      item.get("gender", ""),
                    "category":    item.get("category", ""),
                    "subcategory": item.get("subcategory", ""),
                    "price":       Decimal(str(item.get("price", "0")).replace("$", "").replace(",", "") or "0"),
                    "imagePath":   s3_urls[0],
                    "images":      s3_urls,
                    "product_url": item.get("product_url", ""),
                    "retailer":    item.get("retailer", ""),
                    "vector":      [Decimal(str(v)) for v in vector],  # ← Decimal not float
                    "dim":         dim,
                    "normalized":  True,
                },
                ConditionExpression="attribute_not_exists(product_id)"
            )
            
            spider.logger.info(f"[SAVED] {title} ({product_id}) — {len(s3_urls)} images, dim={dim}")
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "ConditionalCheckFailedException":
                spider.logger.info(f"[DUPLICATE] Race condition on {product_id} — already saved")
            else:
                raise CloseSpider(f"DYNAMODB SAVE ERROR [{code}]: {e.response['Error']['Message']}")
        except Exception as e:
            raise CloseSpider(f"DYNAMODB UNEXPECTED SAVE ERROR: {type(e).__name__}: {e}")

        return item

    def close_spider(self, spider):
        pass