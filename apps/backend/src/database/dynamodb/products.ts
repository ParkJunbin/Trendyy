import { PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { rankProductsBySimilarity, ScoredProduct } from "../../helper/rank";
import { getPresignedUrl } from "../s3/s3";
import { db } from "./client";

const PRODUCTS_TABLE = "The_Iconic";

export type Product = {
  id: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  imagePath: string;
};

// NEW: Products now carry vector + dim (embedding dimension).
export type ProductWithVector = Product & {
  vector: number[];  // normalized SigLIP embedding
  dim: number;       // e.g., 768
  normalized?: boolean;  // true for SigLIP in your code
};



export async function saveProduct(product: ProductWithVector) {
  await db.send(
    new PutItemCommand({
      TableName: PRODUCTS_TABLE,
      Item: {
        product_id: { S: product.id },
        title: { S: product.title },
        brand: { S: product.brand },
        category: { S: product.category },
        price: { N: product.price.toString() },
        imagePath: { S: product.imagePath },

        // CHANGED: store as "vector" + "dim"
        vector: { L: product.vector.map((v) => ({ N: v.toString() })) },
        dim: { N: product.dim.toString() },

        // optional fields if you track them
        ...(product.normalized !== undefined
          ? { normalized: { BOOL: product.normalized } }
          : {}),
      },
    })
  );
}

export async function getAllProducts(): Promise<ProductWithVector[]> {
  const res = await db.send(
    new ScanCommand({
      TableName: PRODUCTS_TABLE,
    })
  );

  if (!res.Items) return [];

  const products = res.Items.map((item) => unmarshall(item)) as ProductWithVector[];

  return Promise.all(
    products.map(async (product) => {
      if (!product.imagePath) return product;

      try {
        const imageUrl = new URL(product.imagePath);
        const objectKey = decodeURIComponent(imageUrl.pathname.replace(/^\/+/, ""));
        return {
          ...product,
          imagePath: await getPresignedUrl(objectKey),
        };
      } catch {
        return product;
      }
    })
  );
}

export function searchProductsByEmbedding(
  queryVector: number[],
  products: ProductWithVector[],
  topK = 3
): ScoredProduct[] {
  return rankProductsBySimilarity(queryVector, products, topK, true);
}