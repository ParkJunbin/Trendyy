import os
import uuid
from decimal import Decimal

import boto3
import requests
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from scrapy.exceptions import CloseSpider, DropItem

load_dotenv()

EMBED_API_URL = os.getenv("EMBED_API_URL", "http://localhost:8000/embed/url")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")


class FashionPipeline:
    """Scrapy pipeline that uploads product images, generates embeddings, and persists items."""

    def _log_environment(self, spider):
        """Log the runtime configuration so startup issues are easy to diagnose."""
        spider.logger.info(f"ENV CHECK — S3_BUCKET_NAME: {os.getenv('S3_BUCKET_NAME')}")
        spider.logger.info(f"ENV CHECK — SCRAPER_DYNAMODB_TABLE: {os.getenv('SCRAPER_DYNAMODB_TABLE')}")
        spider.logger.info(f"ENV CHECK — EMBED_API_URL: {EMBED_API_URL}")
        spider.logger.info(f"ENV CHECK — AWS_REGION: {AWS_REGION}")

    def _validate_environment(self):
        """Fail fast if required AWS or storage settings are missing."""
        if not S3_BUCKET:
            raise CloseSpider("MISSING ENV: S3_BUCKET_NAME is not set")
        if not os.getenv("AWS_ACCESS_KEY_ID"):
            raise CloseSpider("MISSING ENV: AWS_ACCESS_KEY_ID is not set")
        if not os.getenv("AWS_SECRET_ACCESS_KEY"):
            raise CloseSpider("MISSING ENV: AWS_SECRET_ACCESS_KEY is not set")

    def _aws_client_kwargs(self):
        """Collect the shared boto3 credential arguments in one place."""
        return {
            "region_name": AWS_REGION,
            "aws_access_key_id": os.getenv("AWS_ACCESS_KEY_ID"),
            "aws_secret_access_key": os.getenv("AWS_SECRET_ACCESS_KEY"),
        }

    def _build_s3_client(self):
        """Create the S3 client used for image uploads and presigned URLs."""
        try:
            return boto3.client("s3", **self._aws_client_kwargs())
        except Exception as exc:
            raise CloseSpider(f"S3 CLIENT ERROR: {exc}")

    def _build_dynamo_table(self):
        """Create the DynamoDB table handle used to check duplicates and persist items."""
        try:
            dynamo = boto3.resource("dynamodb", **self._aws_client_kwargs())
            return dynamo.Table(os.getenv("SCRAPER_DYNAMODB_TABLE", "scraped_products"))
        except Exception as exc:
            raise CloseSpider(f"DYNAMODB CLIENT ERROR: {exc}")

    def _product_id(self, item):
        """Prefer the retailer SKU and fall back to a generated ID when needed."""
        return item.get("sku") or str(uuid.uuid4())

    def clean_image_url(self, url):
        """Normalize image URLs and ignore values that cannot be fetched directly."""
        if not url:
            return None
        if url.startswith("data:"):
            return None
        if url.startswith("//"):
            return "https:" + url
        if not url.startswith("http"):
            return None
        return url

    def _upload_images(self, item, product_id, spider):
        """Download each image and upload the successful ones to S3."""
        s3_urls = []
        first_key = None
        image_urls = item.get("images") or [item.get("image_url")]

        for index, image_candidate in enumerate(image_urls):
            # The downloader can only handle fetchable HTTP URLs, so normalize before requesting.
            clean_url = self.clean_image_url(image_candidate)
            if not clean_url:
                spider.logger.debug(f"[S3] Skipping invalid URL for image {index}: {str(image_candidate)[:60]}")
                continue

            try:
                response = requests.get(clean_url, timeout=10)
                response.raise_for_status()

                key = f"scraped/{item.get('retailer')}/{product_id}/image_{index}.jpg"
                self.s3.put_object(
                    Bucket=S3_BUCKET,
                    Key=key,
                    Body=response.content,
                    ContentType=response.headers.get("Content-Type", "image/jpeg"),
                )
                # Keep the public URL list and remember the first successful key for embedding.
                s3_urls.append(f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}")

                if first_key is None:
                    first_key = key
                spider.logger.debug(f"[S3] Uploaded image {index} for {product_id}")
            except requests.HTTPError as exc:
                spider.logger.warning(
                    f"[S3] HTTP {exc.response.status_code} downloading image {index} for {product_id}: {exc}"
                )
            except ClientError as exc:
                code = exc.response["Error"]["Code"]
                msg = exc.response["Error"]["Message"]
                raise CloseSpider(f"S3 UPLOAD ERROR [{code}]: {msg}")
            except Exception as exc:
                spider.logger.warning(f"[S3] Failed image {index} for {product_id}: {type(exc).__name__}: {exc}")

        return s3_urls, first_key

    def _generate_presigned_url(self, key):
        """Create a short-lived URL that the embedding worker can fetch."""
        try:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": key},
                ExpiresIn=300,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            msg = exc.response["Error"]["Message"]
            raise CloseSpider(f"PRESIGNED URL ERROR [{code}]: {msg}")
        except Exception as exc:
            raise CloseSpider(f"UNEXPECTED ERROR generating presigned URL: {exc}")

    def _generate_embedding(self, product_id, presigned_url, spider):
        """Ask the embedding worker to vectorize the uploaded product image."""
        try:
            spider.logger.info(f"[EMBED] Calling embed worker for {product_id}")
            embed_res = requests.post(
                EMBED_API_URL,
                params={"image_url": presigned_url},
                timeout=30,
            )
            embed_res.raise_for_status()

            embed_data = embed_res.json()
            # The worker returns both the vector and its dimensionality.
            vector = embed_data["vector"]
            dim = embed_data["dim"]
            spider.logger.info(f"[EMBED] Success — dim={dim} for {product_id}")
            return vector, dim
        except requests.ConnectionError:
            raise CloseSpider(f"EMBED WORKER ERROR: Cannot connect to {EMBED_API_URL} — is the embed worker running?")
        except requests.HTTPError as exc:
            raise CloseSpider(f"EMBED WORKER ERROR: HTTP {exc.response.status_code} — {exc.response.text}")
        except requests.Timeout:
            raise CloseSpider(f"EMBED WORKER ERROR: Timed out connecting to {EMBED_API_URL}")
        except KeyError as exc:
            raise CloseSpider(f"EMBED WORKER ERROR: Missing key in response {exc} — response was: {embed_res.text}")
        except Exception as exc:
            raise CloseSpider(f"EMBED WORKER UNEXPECTED ERROR: {type(exc).__name__}: {exc}")

    def _save_to_dynamo(self, item, product_id, s3_urls, vector, dim, spider):
        """Persist the normalized item payload into DynamoDB."""
        try:
            self.table.put_item(
                Item={
                    "product_id": product_id,
                    "title": item.get("title", ""),
                    "brand": item.get("brand", ""),
                    "gender": item.get("gender", ""),
                    "category": item.get("category", ""),
                    "subcategory": item.get("subcategory", ""),
                    # Keep price as a Decimal so DynamoDB stores it as a numeric type.
                    "price": Decimal(str(item.get("price", "0")).replace("$", "").replace(",", "") or "0"),
                    "imagePath": s3_urls[0],
                    "images": s3_urls,
                    "product_url": item.get("product_url", ""),
                    "retailer": item.get("retailer", ""),
                    # Store vector values as Decimal to avoid float serialization issues.
                    "vector": [Decimal(str(value)) for value in vector],
                    "dim": dim,
                    "normalized": True,
                },
                ConditionExpression="attribute_not_exists(product_id)",
            )
            spider.logger.info(f"[SAVED] {item.get('title', 'unknown')} ({product_id}) — {len(s3_urls)} images, dim={dim}")
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "ConditionalCheckFailedException":
                spider.logger.info(f"[DUPLICATE] Race condition on {product_id} — already saved")
            else:
                raise CloseSpider(f"DYNAMODB SAVE ERROR [{code}]: {exc.response['Error']['Message']}")
        except Exception as exc:
            raise CloseSpider(f"DYNAMODB UNEXPECTED SAVE ERROR: {type(exc).__name__}: {exc}")

    def open_spider(self, spider):
        """Initialize external clients and verify the scraper can start safely."""
        self._log_environment(spider)
        self._validate_environment()

        self.s3 = self._build_s3_client()
        self.table = self._build_dynamo_table()

        spider.logger.info(f"Pipeline ready — S3: {S3_BUCKET} | DynamoDB: {self.table.name}")

    def process_item(self, item, spider):
        """Validate, enrich, upload, vectorize, and persist one scraped product."""
        image_url = item.get("image_url")
        product_id = self._product_id(item)
        title = item.get("title", "unknown")

        # These fields are required by the downstream pipeline and database record.
        if not image_url:
            raise DropItem(f"[{product_id}] No image_url — skipping")

        if not item.get("title"):
            raise DropItem(f"[{product_id}] No title — skipping")

        # Duplicate detection happens before any network calls to avoid unnecessary work.
        try:
            result = self.table.get_item(Key={"product_id": product_id})
            if "Item" in result:
                spider.logger.info(f"[DUPLICATE] Skipping: {title} ({product_id})")
                raise DropItem(f"Duplicate: {product_id}")
        except DropItem:
            raise
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            msg = exc.response["Error"]["Message"]
            raise CloseSpider(f"DYNAMODB ERROR during lookup [{code}]: {msg}")
        except Exception as exc:
            raise CloseSpider(f"UNEXPECTED ERROR during DynamoDB lookup: {exc}")

        # Upload all usable images, then use the first successful upload for embedding.
        s3_urls, first_key = self._upload_images(item, product_id, spider)

        if not s3_urls:
            raise DropItem(f"[{product_id}] All image uploads failed — skipping")

        # The embed worker needs a URL it can fetch directly, so we pass a presigned object URL.
        presigned_url = self._generate_presigned_url(first_key)
        spider.logger.info(f"[PRESIGN] Generated URL for key: {first_key}")

        vector, dim = self._generate_embedding(product_id, presigned_url, spider)
        self._save_to_dynamo(item, product_id, s3_urls, vector, dim, spider)

        return item

    def close_spider(self, spider):
        """Scrapy lifecycle hook kept for symmetry and future cleanup."""
        pass