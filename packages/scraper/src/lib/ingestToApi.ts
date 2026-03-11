import axios from "axios";
import { ScrapedProduct } from "./types";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export async function ingestProducts(products: ScrapedProduct[]): Promise<void> {
  if (!products.length) {
    console.log("No products to ingest.");
    return;
  }

  await axios.post(`${apiBaseUrl}/ingest/products`, products, {
    timeout: Number(process.env.SCRAPER_API_TIMEOUT_MS ?? 20000),
  });

  console.log(`Ingested ${products.length} products into API.`);
}
