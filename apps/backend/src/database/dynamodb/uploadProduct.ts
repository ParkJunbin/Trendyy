import { getImageEmbedding } from "../../ai/embedImage";
import { getImageTags, TagsResponse } from "../../ai/tagImage";
import { rankProductsBySimilarity } from "../../helper/rank";
import { uploadToS3, getPresignedUrl } from "../s3/s3";
import { getScrapedProducts, ProductWithVector, saveProduct } from "./products";

const DEFAULT_TAG_THRESHOLD = 0.6;
const UPLOAD_PREFIX = "uploads";
const TOP_MATCH_COUNT = 3;
const EMBEDDINGS_ARE_NORMALIZED = true;

export type UploadProductInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  title?: string;
  brand?: string;
  category?: string;
  price?: string | number;
  tagThreshold?: number;
};

export type UploadProductResult = {
  message: string;
  filename: string;
  topMatches: Awaited<ReturnType<typeof rankProductsBySimilarity>>;
  tags: TagsResponse;
  tagThreshold: number;
  queryDim: number;
  imageUrl: string;
};

function extractCategoryFromTags(tags: TagsResponse, fallbackCategory = "") {
  const detectedCategoryTags = (tags.category ?? []).map((item) => item.tag);
  const detectedColorTags = (tags.color ?? []).map((item) => item.tag);
  const detectedMaterialTags = (tags.material ?? []).map((item) => item.tag);

  const combinedTags = [
    ...detectedCategoryTags,
    ...detectedColorTags,
    ...detectedMaterialTags,
  ];

  const uniqueTags = [...new Set(combinedTags)];
  return uniqueTags.join(", ") || fallbackCategory;
}

export async function processUploadedProduct(
  input: UploadProductInput
): Promise<UploadProductResult> {
  const tagThreshold = input.tagThreshold ?? DEFAULT_TAG_THRESHOLD;
  const tagResult = await getImageTags(
    input.buffer,
    input.originalName,
    input.mimeType,
    tagThreshold
  );

  const categoryFromTags = extractCategoryFromTags(
    tagResult.tags,
    input.category ?? ""
  );

  const productId = Date.now();
  const key = `${UPLOAD_PREFIX}/${productId}-${input.originalName}`;
  const imageUrl = await uploadToS3(input.buffer, key, input.mimeType);
  const signedUrl = await getPresignedUrl(key);
  const { vector, dim } = await getImageEmbedding(signedUrl);

  const product: ProductWithVector = {
    id: productId.toString(),
    title: input.title ?? input.originalName,
    brand: input.brand ?? "",
    category: categoryFromTags,
    price: Number(input.price ?? 0),
    imagePath: imageUrl,
    vector,
    dim,
    normalized: EMBEDDINGS_ARE_NORMALIZED,
  };

  await saveProduct(product);

  const products = await getScrapedProducts();
  const topMatches = rankProductsBySimilarity(
    vector,
    products,
    TOP_MATCH_COUNT,
    EMBEDDINGS_ARE_NORMALIZED
  );

  return {
    message: "Upload and recommendation successful",
    filename: key,
    topMatches,
    tags: tagResult.tags,
    tagThreshold: tagResult.threshold,
    queryDim: dim,
    imageUrl,
  };
}