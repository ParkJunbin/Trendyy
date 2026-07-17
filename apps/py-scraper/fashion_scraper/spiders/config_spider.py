from urllib.parse import urljoin

import scrapy
from scrapy.exceptions import CloseSpider
from scrapy_playwright.page import PageMethod

from fashion_scraper.config_loader import load_site_config


class ConfigDrivenSpider(scrapy.Spider):
    name = "config_spider"

    def __init__(self, site=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.site = site
        self._config = load_site_config(site)

        self.start_urls = self._config["start_urls"]
        self.base_url = self._config["base_url"]
        self.retailer = self._config["retailer"]

        selectors = self._config["selectors"]
        self.product_selector = selectors["listing_product"]
        self.link_selector = selectors["listing_product_link"]
        self.sku_selector = selectors.get("sku")
        self.brand_selector = selectors.get("brand")
        self.title_selector = selectors.get("title")
        self.price_selector = selectors.get("price")
        self.pagination_selector = selectors.get("pagination_next")
        self.image_selectors = selectors["images"]
        self.breadcrumb_selector = selectors.get("breadcrumb", ".breadcrumb a::text")

        taxonomy = self._config.get("taxonomy", {})
        self.gender_default = taxonomy.get("gender_default", "Women")
        self.gender_index = taxonomy.get("gender_index", 1)
        self.category_index = taxonomy.get("category_index", 2)
        self.subcategory_index = taxonomy.get("subcategory_index", 3)

        playwright_cfg = self._config.get("playwright", {})
        self.listing_wait_ms = playwright_cfg.get("listing_wait_ms", 3000)
        self.product_wait_ms = playwright_cfg.get("product_wait_ms", 2000)

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        try:
            return super().from_crawler(crawler, *args, **kwargs)
        except ValueError as exc:
            raise CloseSpider(str(exc))

    def _listing_request_meta(self):
        return {
            "playwright": True,
            "playwright_page_methods": [
                PageMethod("wait_for_timeout", self.listing_wait_ms),
                PageMethod("wait_for_selector", self.product_selector),
            ],
        }

    def _product_request_meta(self, product, product_url):
        return {
            "playwright": True,
            "playwright_page_methods": [
                PageMethod("wait_for_timeout", self.product_wait_ms),
            ],
            "sku": self._extract_text(product, self.sku_selector),
            "brand": self._extract_text(product, self.brand_selector),
            "title": self._extract_text(product, self.title_selector),
            "price": self._extract_text(product, self.price_selector, default="").strip(),
            "product_url": urljoin(self.base_url, product_url),
            "retailer": self.retailer,
        }

    def _extract_text(self, node, selector, default=None):
        if not selector:
            return default
        return node.css(selector).get(default)

    def _extract_images(self, response):
        for selector in self.image_selectors:
            images = response.css(selector).getall()
            if images:
                return [urljoin(self.base_url, image) for image in images]
        return []

    def _extract_breadcrumb_fields(self, response):
        breadcrumbs = [crumb.strip() for crumb in response.css(self.breadcrumb_selector).getall() if crumb.strip()]
        self.logger.debug("[BREADCRUMB] %s for %s", breadcrumbs, response.url)

        return {
            "gender": breadcrumbs[self.gender_index] if len(breadcrumbs) > self.gender_index else self.gender_default,
            "category": breadcrumbs[self.category_index] if len(breadcrumbs) > self.category_index else "",
            "subcategory": breadcrumbs[self.subcategory_index] if len(breadcrumbs) > self.subcategory_index else "",
        }

    def _listing_status_guard(self, response):
        if response.status == 403:
            raise CloseSpider(f"BLOCKED (403): site is blocking the scraper at {response.url}")
        if response.status != 200:
            raise CloseSpider(f"UNEXPECTED STATUS {response.status} at {response.url}")

    def _product_status_guard(self, response):
        if response.status == 403:
            self.logger.warning("[403] Blocked on product page: %s - skipping", response.url)
            return False
        if response.status != 200:
            self.logger.warning("[%s] Unexpected status on %s - skipping", response.status, response.url)
            return False
        return True

    def start_requests(self):
        for url in self.start_urls:
            yield scrapy.Request(url, meta=self._listing_request_meta(), errback=self.handle_error)

    def parse(self, response):
        self._listing_status_guard(response)

        products = response.css(self.product_selector)
        if not products:
            self.logger.warning("NO PRODUCTS FOUND on %s - selectors may have changed", response.url)

        self.logger.info("[PAGE] Found %s products on %s", len(products), response.url)

        for product in products:
            product_url = product.css(self.link_selector).get()
            if not product_url:
                self.logger.warning("[SKIP] Product has no URL - skipping")
                continue

            yield response.follow(
                product_url,
                self.parse_product,
                meta=self._product_request_meta(product, product_url),
                errback=self.handle_error,
            )

        if self.pagination_selector:
            next_page = response.css(self.pagination_selector).get()
            if next_page:
                self.logger.info("[PAGINATION] Following next page: %s", next_page)
                yield response.follow(
                    next_page,
                    self.parse,
                    meta=self._listing_request_meta(),
                    errback=self.handle_error,
                )

    def parse_product(self, response):
        if not self._product_status_guard(response):
            return

        images = self._extract_images(response)
        if not images:
            self.logger.warning("[NO IMAGES] Could not find images on %s", response.url)

        meta = response.meta
        category_fields = self._extract_breadcrumb_fields(response)

        yield {
            "sku": meta.get("sku"),
            "title": meta.get("title"),
            "brand": meta.get("brand"),
            "price": meta.get("price"),
            "product_url": meta.get("product_url"),
            "retailer": meta.get("retailer"),
            "gender": category_fields["gender"],
            "category": category_fields["category"],
            "subcategory": category_fields["subcategory"],
            "images": images,
            "image_url": images[0] if images else None,
        }

    def handle_error(self, failure):
        request = failure.request
        self.logger.error("[REQUEST FAILED] %s", request.url)
        self.logger.error("[ERROR TYPE] %s", failure.type.__name__)
        self.logger.error("[ERROR MESSAGE] %s", failure.getErrorMessage())
