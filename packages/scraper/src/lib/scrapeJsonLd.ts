import axios from "axios";
import * as cheerio from "cheerio";
import { ScrapedProduct } from "./types";

function parsePrice(rawValue: unknown): number | undefined {
  const numeric = typeof rawValue === "string" ? Number(rawValue.replace(/[^0-9.]/g, "")) : Number(rawValue);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return undefined;
}

export async function scrapeFromJsonLd(url: string, retailer: string): Promise<ScrapedProduct[]> {
  const response = await axios.get<string>(url, {
    timeout: Number(process.env.SCRAPER_HTTP_TIMEOUT_MS ?? 15000),
    headers: {
      "User-Agent":
        process.env.SCRAPER_USER_AGENT ??
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  const $ = cheerio.load(response.data);
  const products: ScrapedProduct[] = [];

  $("script[type='application/ld+json']").each((_index, element) => {
    const text = $(element).text();
    if (!text) {
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const graphNodes = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)["@graph"] : undefined;
      const nodes = Array.isArray(parsed) ? parsed : Array.isArray(graphNodes) ? graphNodes : [parsed];

      for (const node of nodes) {
        if (!node || node["@type"] !== "Product") {
          continue;
        }

        const image = Array.isArray(node.image) ? node.image[0] : node.image;
        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;

        if (!node.url || !node.name || !image) {
          continue;
        }

        products.push({
          retailer,
          sourceProductId: node.sku ?? node.productID,
          productUrl: node.url,
          title: node.name,
          brand: typeof node.brand === "string" ? node.brand : node.brand?.name,
          category: node.category,
          price: parsePrice(offer?.price),
          currency: offer?.priceCurrency,
          imageUrl: image,
          metadata: {
            source_page: url,
          },
        });
      }
    } catch {
      // Ignore malformed JSON-LD blocks and keep scanning.
    }
  });

  return products;
}
