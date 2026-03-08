import { PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { db } from "./client";

export type Product = {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  imagePath: string;
};

export async function saveProduct(product: Product & { embedding: number[] }) {
  await db.send(
    new PutItemCommand({
      TableName: "products",
      Item: {
        product_id: { S: product.id.toString() },
        title: { S: product.title },
        brand: { S: product.brand },
        category: { S: product.category },
        price: { N: product.price.toString() },
        imagePath: { S: product.imagePath },
        embedding: {
          L: product.embedding.map((v) => ({ N: v.toString() })),
        },
      },
    })
  );
}

export async function getAllProducts() {
  const res = await db.send(
    new ScanCommand({
      TableName: "products",
    })
  );

  if (!res.Items) return [];

  return res.Items.map((item) => unmarshall(item));
}