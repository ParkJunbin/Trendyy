import scrapy
from scrapy_playwright.page import PageMethod
from scrapy.exceptions import CloseSpider

class IconicSpider(scrapy.Spider):
    name = "iconic"
    start_urls = ["https://www.theiconic.com.au/womens-clothing/"]

    def start_requests(self):
        for url in self.start_urls:
            yield scrapy.Request(
                url,
                meta={
                    "playwright": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_timeout", 3000),
                        PageMethod("wait_for_selector", "div.product"),
                    ],
                },
                errback=self.handle_error,
            )

    def parse(self, response):
        if response.status == 403:
            raise CloseSpider(f"BLOCKED (403): The Iconic is blocking the scraper at {response.url}")

        if response.status != 200:
            raise CloseSpider(f"UNEXPECTED STATUS {response.status} at {response.url}")

        products = response.css("div.product")
        if not products:
            self.logger.warning(f"NO PRODUCTS FOUND on {response.url} — selectors may have changed")

        self.logger.info(f"[PAGE] Found {len(products)} products on {response.url}")

        for product in products:
            product_url = product.css("a.product-image-link::attr(href)").get()
            if not product_url:
                self.logger.warning(f"[SKIP] Product has no URL — skipping")
                continue

            yield response.follow(
                product_url,
                self.parse_product,
                meta={
                    "playwright": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_timeout", 2000),
                    ],
                    "sku":         product.css("::attr(data-ti-track-product)").get(),
                    "brand":       product.css("span.brand::text").get(),
                    "title":       product.css("span.name::text").get(),
                    "price":       product.css("span.price::text").get("").strip(),
                    "product_url": "https://www.theiconic.com.au" + product_url,
                    "retailer":    "the_iconic",
                },
                errback=self.handle_error,
            )

        next_page = response.css("li.arrow a[rel='next']::attr(href)").get()
        if next_page:
            self.logger.info(f"[PAGINATION] Following next page: {next_page}")
            yield response.follow(
                next_page,
                self.parse,
                meta={
                    "playwright": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_timeout", 3000),
                        PageMethod("wait_for_selector", "div.product"),
                    ],
                },
                errback=self.handle_error,
            )

    def parse_product(self, response):
        meta = response.meta

        if response.status == 403:
            self.logger.warning(f"[403] Blocked on product page: {response.url} — skipping")
            return

        if response.status != 200:
            self.logger.warning(f"[{response.status}] Unexpected status on {response.url} — skipping")
            return

        # Extract all product images
        images = response.css("img.product-image::attr(src)").getall()
        if not images:
            images = response.css("[class*='gallery'] img::attr(src)").getall()
        if not images:
            images = response.css("figure img::attr(src)").getall()

        if not images:
            self.logger.warning(f"[NO IMAGES] Could not find images on {response.url}")

        # Extract breadcrumb categories
        breadcrumbs = response.css(".breadcrumb a::text").getall()
        self.logger.debug(f"[BREADCRUMB] {breadcrumbs} for {response.url}")

        gender      = breadcrumbs[1].strip() if len(breadcrumbs) > 1 else "Women"
        category    = breadcrumbs[2].strip() if len(breadcrumbs) > 2 else ""
        subcategory = breadcrumbs[3].strip() if len(breadcrumbs) > 3 else ""

        yield {
            "sku":         meta.get("sku"),
            "title":       meta.get("title"),
            "brand":       meta.get("brand"),
            "price":       meta.get("price"),
            "product_url": meta.get("product_url"),
            "retailer":    meta.get("retailer"),
            "gender":      gender,
            "category":    category,
            "subcategory": subcategory,
            "images":      images,
            "image_url":   images[0] if images else None,
        }

    def handle_error(self, failure):
        request = failure.request
        self.logger.error(f"[REQUEST FAILED] {request.url}")
        self.logger.error(f"[ERROR TYPE] {failure.type.__name__}")
        self.logger.error(f"[ERROR MESSAGE] {failure.getErrorMessage()}")