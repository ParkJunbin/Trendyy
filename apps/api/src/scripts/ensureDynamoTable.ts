import "dotenv/config";
import { CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { PRODUCTS_TABLE_NAME, db } from "../database/client";

async function main() {
  try {
    const table = await db.send(new DescribeTableCommand({ TableName: PRODUCTS_TABLE_NAME }));
    console.log(`DynamoDB table already exists: ${table.Table?.TableName}`);
    return;
  } catch (error: any) {
    if (error?.name !== "ResourceNotFoundException") {
      throw error;
    }
  }

  console.log(`Creating DynamoDB table: ${PRODUCTS_TABLE_NAME}`);

  await db.send(
    new CreateTableCommand({
      TableName: PRODUCTS_TABLE_NAME,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  console.log("CreateTable requested. Table may take a few seconds to become ACTIVE.");
}

main()
  .catch((error) => {
    console.error("Failed to ensure table:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    db.destroy();
  });
