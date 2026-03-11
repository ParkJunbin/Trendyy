import "dotenv/config";
import { ingestProducts } from "./lib/ingestToApi";
import { scrapeFromJsonLd } from "./lib/scrapeJsonLd";

async function main() {
  const listingUrl =
    process.env.ICONIC_LISTING_URL ?? "https://www.theiconic.com.au/mens-clothing/";

  console.log(`Scraping: ${listingUrl}`);
  const products = await scrapeFromJsonLd(listingUrl, "the-iconic");

  if (!products.length) {
    console.log("No Product JSON-LD entries found. Try updating ICONIC_LISTING_URL.");
    return;
  }

  await ingestProducts(products);
}

main().catch((error) => {
  console.error("Iconic scrape failed:", error);
  process.exitCode = 1;
});
