import "dotenv/config";
import { closeDb } from "../database/client";
import { claimPendingProducts } from "../database/products";
import { processProduct } from "../pipeline/processProduct";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const batchSize = Number(process.env.PROCESSING_BATCH_SIZE ?? 10);
  const pollIntervalMs = Number(process.env.PROCESSING_POLL_INTERVAL_MS ?? 5000);
  const once = process.argv.includes("--once");

  do {
    const batch = await claimPendingProducts(batchSize);

    if (!batch.length) {
      if (once) {
        console.log("No pending products found.");
        break;
      }

      console.log(`No pending products found. Polling again in ${pollIntervalMs}ms.`);
      await sleep(pollIntervalMs);
      continue;
    }

    console.log(`Processing ${batch.length} product(s).`);

    for (const product of batch) {
      await processProduct(product);
    }

    if (once) {
      break;
    }
  } while (true);
}

main()
  .catch((error) => {
    console.error("Worker failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
