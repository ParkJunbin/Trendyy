import { analyzeImage } from "../ai/inferenceClient";
import {
  ProductRecord,
  markProductFailed,
  markProductProcessed,
} from "../database/products";

export async function processProduct(product: ProductRecord): Promise<void> {
  try {
    const analysisResult = await analyzeImage({
      image_url: product.imageUrl,
      top_k: Number(process.env.FASHION_TAG_TOP_K ?? 5),
    });

    await markProductProcessed(product.id, {
      embedding: analysisResult.embedding,
      embeddingModel: analysisResult.model_id,
      predictedTags: analysisResult.predicted_tags,
      tagScores: analysisResult.tag_scores,
      analysis: {
        model_id: analysisResult.model_id,
        image_url: product.imageUrl,
        tag_scores: analysisResult.tag_scores,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    await markProductFailed(product.id, message);
  }
}
