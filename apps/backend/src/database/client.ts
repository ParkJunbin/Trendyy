import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const db = new DynamoDBClient({
  region: "ap-southeast-2",
});