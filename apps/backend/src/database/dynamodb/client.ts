import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const db = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
});