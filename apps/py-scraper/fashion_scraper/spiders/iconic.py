import scrapy
from scrapy_playwright.page import PageMethod

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
                        PageMethod("wait_for_timeout", 3000),  # wait 3 seconds
                        PageMethod("wait_for_selector", "div.product"),
                    ],
                }
            )

    def parse(self, response):
        for product in response.css("div.product"):
            product_url = product.css("a.product-image-link::attr(href)").get()
            yield {
                "sku":         product.css("::attr(data-ti-track-product)").get(),
                "title":       product.css("span.name::text").get(),
                "brand":       product.css("span.brand::text").get(),
                "price":       product.css("span.price::text").get("").strip(),
                "product_url": "https://www.theiconic.com.au" + product_url if product_url else None,
                "image_url":   product.css("img::attr(src)").get(),
                "retailer":    "the_iconic",
                "category":    "womens-clothing",
            }

        next_page = response.css("li.arrow a[rel='next']::attr(href)").get()
        if next_page:
            yield response.follow(
                next_page,
                self.parse,
                meta={
                    "playwright": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_timeout", 3000),
                        PageMethod("wait_for_selector", "div.product"),
                    ],
                }
            )