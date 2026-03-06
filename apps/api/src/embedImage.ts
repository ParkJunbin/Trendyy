import { pipeline } from "@xenova/transformers";

let extractor: Awaited<ReturnType<typeof pipeline>> | null = null;

export async function getImageEmbedding(imagePath: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline(
      "image-feature-extraction",
      "Xenova/clip-vit-base-patch32"
    );
  }

  const output = await extractor(imagePath, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data as Float32Array);
}