import { analyzeImage } from "./inferenceClient";

// Legacy compatibility helper used by existing upload flows.
export async function getImageEmbedding(imagePath: string): Promise<number[]> {
  const result = await analyzeImage({ image_path: imagePath });
  return result.embedding;
}
