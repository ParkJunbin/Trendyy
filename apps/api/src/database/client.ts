import "dotenv/config";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const PRODUCTS_TABLE_NAME = process.env.DYNAMODB_PRODUCTS_TABLE ?? "products";

export const db = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
});

export async function closeDb(): Promise<void> {
  db.destroy();
}
