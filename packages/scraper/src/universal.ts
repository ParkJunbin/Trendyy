import "dotenv/config";
import { ingestProducts } from "./lib/ingestToApi";
import { scrapeFromJsonLd } from "./lib/scrapeJsonLd";

async function main() {
  const listingUrl =
    process.env.UNIVERSAL_LISTING_URL ?? "https://www.universalstore.com/collections/mens-clothing";

  console.log(`Scraping: ${listingUrl}`);
  const products = await scrapeFromJsonLd(listingUrl, "universal-store");

  if (!products.length) {
    console.log("No Product JSON-LD entries found. Try updating UNIVERSAL_LISTING_URL.");
    return;
  }

  await ingestProducts(products);
}

main().catch((error) => {
  console.error("Universal scrape failed:", error);
  process.exitCode = 1;
});
