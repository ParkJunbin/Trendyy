import json
from pathlib import Path


_CONFIG_DIR = Path(__file__).resolve().parent / "site_configs"


def _required(config, key):
    if key not in config:
        raise ValueError(f"Missing required config key: {key}")


def load_site_config(site_id):
    if not site_id:
        raise ValueError("site_id is required")

    config_path = _CONFIG_DIR / f"{site_id}.json"
    if not config_path.exists():
        raise ValueError(f"Site config not found: {config_path.name}")

    with config_path.open("r", encoding="utf-8") as f:
        config = json.load(f)

    _required(config, "site_id")
    _required(config, "retailer")
    _required(config, "base_url")
    _required(config, "start_urls")
    _required(config, "selectors")

    selectors = config["selectors"]
    _required(selectors, "listing_product")
    _required(selectors, "listing_product_link")
    _required(selectors, "images")

    return config
