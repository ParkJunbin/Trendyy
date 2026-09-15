from fashion_scraper.spiders.config_spider import ConfigDrivenSpider


class IconicSpider(ConfigDrivenSpider):
    name = "iconic"

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("site", "iconic")
        super().__init__(*args, **kwargs)