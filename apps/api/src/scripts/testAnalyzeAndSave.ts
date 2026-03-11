import "dotenv/config";
import { closeDb } from "../database/client";
import { analyzeImage } from "../ai/inferenceClient";
import { markProductProcessed, upsertScrapedProduct } from "../database/products";

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const imageUrl = parseArg("--image-url") ?? process.env.TEST_IMAGE_URL;

  if (!imageUrl) {
    throw new Error("Provide --image-url <url> or set TEST_IMAGE_URL");
  }

  const retailer = parseArg("--retailer") ?? "manual-test";
  const productUrl = parseArg("--product-url") ?? imageUrl;
  const title = parseArg("--title") ?? "Pipeline Test Product";

  const product = await upsertScrapedProduct({
    retailer,
    productUrl,
    title,
    brand: parseArg("--brand") ?? "unknown",
    category: parseArg("--category") ?? "unknown",
    price: Number(parseArg("--price") ?? 0),
    currency: parseArg("--currency") ?? "USD",
    imageUrl,
    metadata: {
      source: "test-analyze-and-save-script",
    },
  });

  const analysis = await analyzeImage({
    image_url: imageUrl,
    top_k: Number(process.env.FASHION_TAG_TOP_K ?? 5),
  });

  await markProductProcessed(product.id, {
    embedding: analysis.embedding,
    embeddingModel: analysis.model_id,
    predictedTags: analysis.predicted_tags,
    tagScores: analysis.tag_scores,
    analysis: {
      model_id: analysis.model_id,
      image_url: imageUrl,
      tag_scores: analysis.tag_scores,
      script: "testAnalyzeAndSave",
    },
  });

  console.log(`Product ID: ${product.id}`);
  console.log(`Embedding length: ${analysis.embedding.length}`);
  console.log("Top tags:");
  analysis.tag_scores.forEach((tag) => {
    console.log(`- ${tag.tag}: ${tag.score.toFixed(4)}`);
  });
}

main()
  .catch((error) => {
    console.error("Script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
