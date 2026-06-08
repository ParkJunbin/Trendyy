import scrapy
from scrapy_playwright.page import PageMethod
from scrapy.exceptions import CloseSpider


class IconicSpider(scrapy.Spider):
    name = "iconic"
    start_urls = ["https://www.theiconic.com.au/womens-clothing/"]

    # Timing values keep Playwright on each page long enough for product tiles and pages to render.
    LISTING_WAIT_MS = 3000
    PRODUCT_WAIT_MS = 2000
    PRODUCT_SELECTOR = "div.product"

    def _listing_request_meta(self):
        """Build Playwright request settings for listing pages."""
        return {
            "playwright": True,
            "playwright_page_methods": [
                # Wait briefly for client-rendered content, then assert the product selector is present.
                PageMethod("wait_for_timeout", self.LISTING_WAIT_MS),
                PageMethod("wait_for_selector", self.PRODUCT_SELECTOR),
            ],
        }

    def _product_request_meta(self, product, product_url):
        """Build Playwright request settings and carry listing metadata into the product request."""
        return {
            "playwright": True,
            "playwright_page_methods": [
                # Product pages usually need a shorter render delay than listings.
                PageMethod("wait_for_timeout", self.PRODUCT_WAIT_MS),
            ],
            # The pipeline uses this metadata later, so keep the listing-derived fields together here.
            "sku": product.css("::attr(data-ti-track-product)").get(),
            "brand": product.css("span.brand::text").get(),
            "title": product.css("span.name::text").get(),
            "price": product.css("span.price::text").get("").strip(),
            "product_url": "https://www.theiconic.com.au" + product_url,
            "retailer": "the_iconic",
        }

    def _extract_images(self, response):
        """Try multiple image selectors in order of preference."""
        image_selectors = [
            "img.product-image::attr(src)",
            "[class*='gallery'] img::attr(src)",
            "figure img::attr(src)",
        ]

        for selector in image_selectors:
            # The first selector that returns images wins; later fallbacks stay untouched.
            images = response.css(selector).getall()
            if images:
                return images
        return []

    def _extract_breadcrumb_fields(self, response):
        """Map breadcrumb text into the normalized taxonomy used by downstream storage."""
        breadcrumbs = response.css(".breadcrumb a::text").getall()
        self.logger.debug(f"[BREADCRUMB] {breadcrumbs} for {response.url}")

        return {
            # The page structure is not guaranteed, so the defaults keep the item usable when breadcrumbs are sparse.
            "gender": breadcrumbs[1].strip() if len(breadcrumbs) > 1 else "Women",
            "category": breadcrumbs[2].strip() if len(breadcrumbs) > 2 else "",
            "subcategory": breadcrumbs[3].strip() if len(breadcrumbs) > 3 else "",
        }

    def _listing_status_guard(self, response):
        """Fail fast on listing pages because we cannot continue crawling without them."""
        if response.status == 403:
            raise CloseSpider(f"BLOCKED (403): The Iconic is blocking the scraper at {response.url}")

        if response.status != 200:
            raise CloseSpider(f"UNEXPECTED STATUS {response.status} at {response.url}")

    def _product_status_guard(self, response):
        """Skip blocked or malformed product pages without stopping the whole spider."""
        if response.status == 403:
            # Product pages are treated as optional; one failure should not stop the crawl.
            self.logger.warning(f"[403] Blocked on product page: {response.url} — skipping")
            return False

        if response.status != 200:
            self.logger.warning(f"[{response.status}] Unexpected status on {response.url} — skipping")
            return False

        return True

    def start_requests(self):
        """Kick off the crawl from the configured listing URLs."""
        for url in self.start_urls:
            yield scrapy.Request(url, meta=self._listing_request_meta(), errback=self.handle_error)

    def parse(self, response):
        """Parse listing pages, follow product links, and advance pagination."""
        self._listing_status_guard(response)

        products = response.css(self.PRODUCT_SELECTOR)
        if not products:
            self.logger.warning(f"NO PRODUCTS FOUND on {response.url} — selectors may have changed")

        self.logger.info(f"[PAGE] Found {len(products)} products on {response.url}")

        for product in products:
            # Product URLs come from the listing card so the product request can inherit context.
            product_url = product.css("a.product-image-link::attr(href)").get()
            if not product_url:
                self.logger.warning("[SKIP] Product has no URL — skipping")
                continue

            yield response.follow(
                product_url,
                self.parse_product,
                meta=self._product_request_meta(product, product_url),
                errback=self.handle_error,
            )

        next_page = response.css("li.arrow a[rel='next']::attr(href)").get()
        if next_page:
            # Pagination uses the same listing request settings so the next page has time to hydrate.
            self.logger.info(f"[PAGINATION] Following next page: {next_page}")
            yield response.follow(next_page, self.parse, meta=self._listing_request_meta(), errback=self.handle_error)

    def parse_product(self, response):
        """Extract the product detail payload that the pipeline expects."""
        if not self._product_status_guard(response):
            return

        images = self._extract_images(response)

        if not images:
            self.logger.warning(f"[NO IMAGES] Could not find images on {response.url}")

        meta = response.meta
        category_fields = self._extract_breadcrumb_fields(response)

        # The returned item keeps the same field names used by the pipeline and database layer.
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
        """Log request-level failures from Playwright or Scrapy network handling."""
        request = failure.request
        self.logger.error(f"[REQUEST FAILED] {request.url}")
        self.logger.error(f"[ERROR TYPE] {failure.type.__name__}")
        self.logger.error(f"[ERROR MESSAGE] {failure.getErrorMessage()}")