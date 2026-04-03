import { getImageEmbedding } from "../../ai/embedImage";
import { getImageTags, TagsResponse } from "../../ai/tagImage";
import { rankProductsBySimilarity } from "../../helper/rank";
import { uploadToS3, getPresignedUrl } from "../s3/s3";
import { getAllProducts, ProductWithVector, saveProduct } from "./products";

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
  const tagThreshold = input.tagThreshold ?? 0.6;
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

  const key = `uploads/${Date.now()}-${input.originalName}`;
  const imageUrl = await uploadToS3(input.buffer, key, input.mimeType);
  const signedUrl = await getPresignedUrl(key);
  const { vector, dim } = await getImageEmbedding(signedUrl);

  const product: ProductWithVector = {
    id: Date.now(),
    title: input.title ?? input.originalName,
    brand: input.brand ?? "",
    category: categoryFromTags,
    price: Number(input.price ?? 0),
    imagePath: imageUrl,
    vector,
    dim,
    normalized: true,
  };

  await saveProduct(product);

  const products = await getAllProducts();
  const topMatches = rankProductsBySimilarity(vector, products, 3, true);

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