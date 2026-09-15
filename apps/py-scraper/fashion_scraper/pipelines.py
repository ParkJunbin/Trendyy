import os
import uuid
from decimal import Decimal

import boto3
import requests
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from scrapy.exceptions import CloseSpider, DropItem


load_dotenv()

EMBED_API_URL = os.getenv(
    "EMBED_API_URL",
    "http://localhost:8000/embed/url"
)

S3_BUCKET = os.getenv("S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")


class FashionPipeline:
    """
    Scrapy pipeline that:
    1. Uploads product images to S3
    2. Generates image embeddings
    3. Persists normalized products to DynamoDB

    Uses the current Scrapy pipeline lifecycle API:
        open_spider(self)
        process_item(self, item)
        close_spider(self)
    """

    @classmethod
    def from_crawler(cls, crawler):
        """
        Create the pipeline and retain the Crawler.

        Scrapy no longer passes the Spider directly to pipeline
        lifecycle methods. If the Spider instance is needed,
        access it through self.crawler.spider.
        """
        pipeline = cls()
        pipeline.crawler = crawler
        return pipeline

    @property
    def spider(self):
        """
        Return the currently running Spider.

        Keeping this lookup through the Crawler avoids relying
        on the deprecated spider argument in pipeline methods.
        """
        return self.crawler.spider

    def _log_environment(self):
        """Log runtime configuration for startup diagnostics."""
        self.spider.logger.info(
            f"ENV CHECK — S3_BUCKET_NAME: {os.getenv('S3_BUCKET_NAME')}"
        )
        self.spider.logger.info(
            f"ENV CHECK — SCRAPER_DYNAMODB_TABLE: "
            f"{os.getenv('SCRAPER_DYNAMODB_TABLE')}"
        )
        self.spider.logger.info(
            f"ENV CHECK — EMBED_API_URL: {EMBED_API_URL}"
        )
        self.spider.logger.info(
            f"ENV CHECK — AWS_REGION: {AWS_REGION}"
        )

    def _validate_environment(self):
        """Fail fast if required AWS settings are missing."""
        if not S3_BUCKET:
            raise CloseSpider(
                "MISSING ENV: S3_BUCKET_NAME is not set"
            )

        if not os.getenv("AWS_ACCESS_KEY_ID"):
            raise CloseSpider(
                "MISSING ENV: AWS_ACCESS_KEY_ID is not set"
            )

        if not os.getenv("AWS_SECRET_ACCESS_KEY"):
            raise CloseSpider(
                "MISSING ENV: AWS_SECRET_ACCESS_KEY is not set"
            )

    def _aws_client_kwargs(self):
        """Collect shared boto3 credential arguments."""
        return {
            "region_name": AWS_REGION,
            "aws_access_key_id": os.getenv(
                "AWS_ACCESS_KEY_ID"
            ),
            "aws_secret_access_key": os.getenv(
                "AWS_SECRET_ACCESS_KEY"
            ),
        }

    def _build_s3_client(self):
        """Create the S3 client."""
        try:
            return boto3.client(
                "s3",
                **self._aws_client_kwargs()
            )
        except Exception as exc:
            raise CloseSpider(
                f"S3 CLIENT ERROR: {exc}"
            )

    def _build_dynamo_table(self):
        """Create the DynamoDB table handle."""
        try:
            dynamo = boto3.resource(
                "dynamodb",
                **self._aws_client_kwargs()
            )

            return dynamo.Table(
                os.getenv(
                    "SCRAPER_DYNAMODB_TABLE",
                    "scraped_products"
                )
            )

        except Exception as exc:
            raise CloseSpider(
                f"DYNAMODB CLIENT ERROR: {exc}"
            )

    def _product_id(self, item):
        """
        Prefer the retailer SKU.

        Fall back to a generated UUID if no SKU exists.
        """
        return item.get("sku") or str(uuid.uuid4())

    def clean_image_url(self, url):
        """Normalize image URLs."""
        if not url:
            return None

        if url.startswith("data:"):
            return None

        if url.startswith("//"):
            return "https:" + url

        if not url.startswith("http"):
            return None

        return url

    def _upload_images(self, item, product_id):
        """Download images and upload successful ones to S3."""
        s3_urls = []
        first_key = None

        image_urls = item.get(
            "images",
            [item.get("image_url")]
        )

        for index, image_candidate in enumerate(image_urls):

            clean_url = self.clean_image_url(
                image_candidate
            )

            if not clean_url:
                self.spider.logger.debug(
                    f"[S3] Skipping invalid URL for image "
                    f"{index}: {str(image_candidate)[:60]}"
                )
                continue

            try:
                response = requests.get(
                    clean_url,
                    timeout=10
                )

                response.raise_for_status()

                key = (
                    f"scraped/"
                    f"{item.get('retailer')}/"
                    f"{product_id}/"
                    f"image_{index}.jpg"
                )

                self.s3.put_object(
                    Bucket=S3_BUCKET,
                    Key=key,
                    Body=response.content,
                    ContentType=response.headers.get(
                        "Content-Type",
                        "image/jpeg"
                    ),
                )

                s3_urls.append(
                    f"https://{S3_BUCKET}.s3."
                    f"{AWS_REGION}.amazonaws.com/{key}"
                )

                if first_key is None:
                    first_key = key

                self.spider.logger.debug(
                    f"[S3] Uploaded image "
                    f"{index} for {product_id}"
                )

            except requests.HTTPError as exc:
                self.spider.logger.warning(
                    f"[S3] HTTP "
                    f"{exc.response.status_code} "
                    f"downloading image {index} "
                    f"for {product_id}: {exc}"
                )

            except ClientError as exc:
                code = exc.response["Error"]["Code"]
                msg = exc.response["Error"]["Message"]

                raise CloseSpider(
                    f"S3 UPLOAD ERROR [{code}]: {msg}"
                )

            except Exception as exc:
                self.spider.logger.warning(
                    f"[S3] Failed image {index} "
                    f"for {product_id}: "
                    f"{type(exc).__name__}: {exc}"
                )

        return s3_urls, first_key

    def _generate_presigned_url(self, key):
        """
        Create a short-lived S3 URL that the
        embedding worker can fetch.
        """
        try:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": S3_BUCKET,
                    "Key": key
                },
                ExpiresIn=300,
            )

        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            msg = exc.response["Error"]["Message"]

            raise CloseSpider(
                f"PRESIGNED URL ERROR [{code}]: {msg}"
            )

        except Exception as exc:
            raise CloseSpider(
                f"UNEXPECTED ERROR generating "
                f"presigned URL: {exc}"
            )

    def _generate_embedding(
        self,
        product_id,
        presigned_url
    ):
        """Generate an image embedding."""
        try:
            self.spider.logger.info(
                f"[EMBED] Calling embed worker "
                f"for {product_id}"
            )

            embed_res = requests.post(
                EMBED_API_URL,
                params={
                    "image_url": presigned_url
                },
                timeout=30,
            )

            embed_res.raise_for_status()

            embed_data = embed_res.json()

            vector = embed_data["vector"]
            dim = embed_data["dim"]

            self.spider.logger.info(
                f"[EMBED] Success — "
                f"dim={dim} for {product_id}"
            )

            return vector, dim

        except requests.ConnectionError:
            raise CloseSpider(
                "EMBED WORKER ERROR: Cannot connect to "
                f"{EMBED_API_URL} — "
                "is the embed worker running?"
            )

        except requests.HTTPError as exc:
            raise CloseSpider(
                f"EMBED WORKER ERROR: "
                f"HTTP {exc.response.status_code} — "
                f"{exc.response.text}"
            )

        except requests.Timeout:
            raise CloseSpider(
                "EMBED WORKER ERROR: "
                f"Timed out connecting to {EMBED_API_URL}"
            )

        except KeyError as exc:
            raise CloseSpider(
                f"EMBED WORKER ERROR: "
                f"Missing key in response {exc} — "
                f"response was: {embed_res.text}"
            )

        except Exception as exc:
            raise CloseSpider(
                "EMBED WORKER UNEXPECTED ERROR: "
                f"{type(exc).__name__}: {exc}"
            )

    def _save_to_dynamo(
        self,
        item,
        product_id,
        s3_urls,
        vector,
        dim
    ):
        """Persist the normalized product to DynamoDB."""
        try:
            self.table.put_item(
                Item={
                    "product_id": product_id,
                    "title": item.get("title", ""),
                    "brand": item.get("brand", ""),
                    "gender": item.get("gender", ""),
                    "category": item.get("category", ""),
                    "subcategory": item.get(
                        "subcategory",
                        ""
                    ),

                    # DynamoDB numeric type
                    "price": Decimal(
                        str(
                            item.get("price", "0")
                        )
                        .replace("$", "")
                        .replace(",", "")
                        or "0"
                    ),

                    "imagePath": s3_urls[0],
                    "images": s3_urls,
                    "product_url": item.get(
                        "product_url",
                        ""
                    ),
                    "retailer": item.get(
                        "retailer",
                        ""
                    ),

                    # DynamoDB does not accept
                    # Python floats directly.
                    "vector": [
                        Decimal(str(value))
                        for value in vector
                    ],

                    "dim": dim,
                    "normalized": True,
                },

                ConditionExpression=(
                    "attribute_not_exists(product_id)"
                ),
            )

            self.spider.logger.info(
                f"[SAVED] "
                f"{item.get('title', 'unknown')} "
                f"({product_id}) — "
                f"{len(s3_urls)} images, "
                f"dim={dim}"
            )

        except ClientError as exc:
            code = exc.response["Error"]["Code"]

            if code == "ConditionalCheckFailedException":
                self.spider.logger.info(
                    f"[DUPLICATE] Race condition on "
                    f"{product_id} — already saved"
                )

            else:
                raise CloseSpider(
                    f"DYNAMODB SAVE ERROR [{code}]: "
                    f"{exc.response['Error']['Message']}"
                )

        except Exception as exc:
            raise CloseSpider(
                "DYNAMODB UNEXPECTED SAVE ERROR: "
                f"{type(exc).__name__}: {exc}"
            )

    # ---------------------------------------------------------
    # Current Scrapy lifecycle API
    # ---------------------------------------------------------

    def open_spider(self):
        """
        Initialize external clients when the spider opens.

        Current Scrapy signature: open_spider(self)
        """
        self._log_environment()
        self._validate_environment()

        self.s3 = self._build_s3_client()
        self.table = self._build_dynamo_table()

        self.spider.logger.info(
            f"Pipeline ready — "
            f"S3: {S3_BUCKET} | "
            f"DynamoDB: {self.table.name}"
        )

    def process_item(self, item):
        """
        Validate, enrich, upload, embed,
        and persist one scraped product.

        Current Scrapy signature: process_item(self, item)
        """
        image_url = item.get("image_url")
        product_id = self._product_id(item)
        title = item.get("title", "unknown")

        # Required downstream fields
        if not image_url:
            raise DropItem(
                f"[{product_id}] No image_url — skipping"
            )

        if not item.get("title"):
            raise DropItem(
                f"[{product_id}] No title — skipping"
            )

        # Check DynamoDB before expensive network operations
        try:
            result = self.table.get_item(
                Key={
                    "product_id": product_id
                }
            )

            if "Item" in result:
                self.spider.logger.info(
                    f"[DUPLICATE] Skipping: "
                    f"{title} ({product_id})"
                )

                raise DropItem(
                    f"Duplicate: {product_id}"
                )

        except DropItem:
            raise

        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            msg = exc.response["Error"]["Message"]

            raise CloseSpider(
                f"DYNAMODB ERROR during lookup "
                f"[{code}]: {msg}"
            )

        except Exception as exc:
            raise CloseSpider(
                "UNEXPECTED ERROR during "
                f"DynamoDB lookup: {exc}"
            )

        # Upload images
        s3_urls, first_key = self._upload_images(
            item,
            product_id
        )

        if not s3_urls:
            raise DropItem(
                f"[{product_id}] "
                "All image uploads failed — skipping"
            )

        # Generate presigned URL
        presigned_url = (
            self._generate_presigned_url(
                first_key
            )
        )

        self.spider.logger.info(
            f"[PRESIGN] Generated URL "
            f"for key: {first_key}"
        )

        # Generate embedding
        vector, dim = self._generate_embedding(
            product_id,
            presigned_url
        )

        # Save product
        self._save_to_dynamo(
            item,
            product_id,
            s3_urls,
            vector,
            dim
        )

        return item

    def close_spider(self):
        """
        Cleanup hook when the spider closes.

        Current Scrapy signature: close_spider(self)
        """
        pass