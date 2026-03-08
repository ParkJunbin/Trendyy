import path from "path";
import { products, Product } from "./products";
import { getImageEmbedding } from "./embedImage";

export type EmbeddedProduct = Product & {
  embedding: number[];
};

let cachedProducts: EmbeddedProduct[] | null = null;

export async function getEmbeddedProducts(): Promise<EmbeddedProduct[]> {
  if (cachedProducts) return cachedProducts;

  const embeddedProducts: EmbeddedProduct[] = [];

  for (const product of products) {
    const absoluteImagePath = path.join(process.cwd(), product.imagePath);

    const embedding = await getImageEmbedding(absoluteImagePath);

    embeddedProducts.push({
      ...product,
      embedding,
    });
  }

  cachedProducts = embeddedProducts;
  return embeddedProducts;
}