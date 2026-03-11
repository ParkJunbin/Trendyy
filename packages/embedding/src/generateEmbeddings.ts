import "dotenv/config";
import axios from "axios";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

async function processBatch(batchSize: number): Promise<number> {
  const response = await axios.post(
    `${apiBaseUrl}/process/pending`,
    { batchSize },
    { timeout: Number(process.env.EMBEDDING_API_TIMEOUT_MS ?? 30000) }
  );

  return Number(response.data?.claimed ?? 0);
}

async function main() {
  const batchSize = Number(process.env.PROCESSING_BATCH_SIZE ?? 10);

  while (true) {
    const claimed = await processBatch(batchSize);
    if (claimed === 0) {
      console.log("No pending products left.");
      break;
    }

    console.log(`Processed batch of ${claimed} products.`);
  }
}

main().catch((error) => {
  console.error("Embedding generation pipeline failed:", error);
  process.exitCode = 1;
});
