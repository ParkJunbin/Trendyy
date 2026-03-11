import "dotenv/config";

async function main() {
  console.log("No SQL migrations are required in DynamoDB mode.");
  console.log("Ensure DynamoDB table exists with partition key: id (String).");
}

main().catch((error) => {
  console.error("Migration helper failed:", error);
  process.exitCode = 1;
});
