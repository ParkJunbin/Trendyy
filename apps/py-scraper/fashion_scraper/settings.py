import os
from dotenv import load_dotenv
load_dotenv()

BOT_NAME = "fashion_scraper"
SPIDER_MODULES = ["fashion_scraper.spiders"]

ITEM_PIPELINES = {
    "fashion_scraper.pipelines.FashionPipeline": 1,
}

CLOSESPIDER_ITEMCOUNT = 500

DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

DOWNLOAD_DELAY = 1.5
AUTOTHROTTLE_ENABLED = True
ROBOTSTXT_OBEY = False

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION    = os.getenv("AWS_REGION")

# ── Silence noisy logs ──────────────────────────────────────────
LOG_LEVEL = "INFO"  # hides all DEBUG messages including Playwright

LOGGERS_DISABLED = [
    "scrapy-playwright",
    "botocore",
    "boto3",
    "urllib3",
]

import logging
for logger_name in LOGGERS_DISABLED:
    logging.getLogger(logger_name).setLevel(logging.WARNING)