import os
import boto3
import requests
import uuid
from dotenv import load_dotenv
from botocore.exceptions import ClientError

load_dotenv()

EMBED_API_URL = os.getenv("EMBED_API_URL", "http://localhost:8000/embed/url")
S3_BUCKET     = os.getenv("S3_BUCKET_NAME")
AWS_REGION    = os.getenv("AWS_REGION", "ap-southeast-2")

class FashionPipeline:
    def open_spider(self, spider):
        self.s3 = boto3.client(
            "s3",
            region_name=AWS_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        self.dynamo = boto3.resource(
            "dynamodb",
            region_name=AWS_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        self.table = self.dynamo.Table("products")

    def process_item(self, item, spider):
        image_url = item.get("image_url")
        if not image_url:
            return item

        # Use SKU as unique product_id, fall back to UUID if missing
        product_id = item.get("sku") or str(uuid.uuid4())

        # 1. Check for duplicate in DynamoDB
        try:
            result = self.table.get_item(Key={"product_id": product_id})
            if "Item" in result:
                spider.logger.info(f"Skipping duplicate: {item.get('title')} ({product_id})")
                return item
        except ClientError as e:
            spider.logger.warning(f"DynamoDB lookup failed: {e}")

        # 2. Download image
        try:
            r = requests.get(image_url, timeout=10)
            r.raise_for_status()
        except Exception as e:
            spider.logger.warning(f"Failed to download image: {e}")
            return item

        # 3. Upload to S3
        key = f"scraped/{item.get('retailer')}/{product_id}.jpg"
        self.s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=r.content,
            ContentType=r.headers.get("Content-Type", "image/jpeg"),
        )
        s3_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

        # 4. Generate embedding via py-embed-worker
        try:
            embed_res = requests.post(
                EMBED_API_URL,
                params={"image_url": s3_url},
                timeout=30
            )
            embed_res.raise_for_status()
            embed_data = embed_res.json()
            vector = embed_data["vector"]
            dim    = embed_data["dim"]
        except Exception as e:
            spider.logger.warning(f"Embedding failed: {e}")
            return item

        # 5. Save to DynamoDB
        self.table.put_item(
            Item={
                "product_id": product_id,
                "title":      item.get("title", ""),
                "brand":      item.get("brand", ""),
                "category":   item.get("category", ""),
                "price":      float(str(item.get("price", "0")).replace("$", "").replace(",", "") or 0),
                "imagePath":  s3_url,
                "product_url": item.get("product_url", ""),
                "retailer":   item.get("retailer", ""),
                "vector":     [str(v) for v in vector],
                "dim":        dim,
                "normalized": True,
            },
            ConditionExpression="attribute_not_exists(product_id)"
        )
        spider.logger.info(f"Saved: {item.get('title')} ({product_id})")
        return item

    def close_spider(self, spider):
        pass