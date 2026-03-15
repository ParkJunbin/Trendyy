
import { ProductWithVector } from "../database/products";
import { similarityNormalized, cosine } from "./similarity";

export type ScoredProduct = ProductWithVector & { similarity: number };

export function rankProductsBySimilarity(
  query: number[],
  products: ProductWithVector[],
  topK = 3,
  assumeNormalized = true
): ScoredProduct[] {
  const scored: ScoredProduct[] = [];

  for (const p of products) {
    if (!p.vector || !Array.isArray(p.vector) || !p.dim) {
      continue; // skip malformed rows
    }
    if (p.dim !== query.length) {
      // skip or handle with dimensionality reduction if needed
      continue;
    }
    const score = assumeNormalized ? similarityNormalized(query, p.vector)
                                   : cosine(query, p.vector);
    scored.push({ ...p, similarity: score });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
