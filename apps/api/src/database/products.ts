import {
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { cosineSimilarity } from "../similarity";
import { PRODUCTS_TABLE_NAME, db } from "./client";

export type ProcessingStatus = "pending" | "processing" | "processed" | "failed";

export type ProductRecord = {
  id: string;
  retailer: string;
  sourceProductId: string | null;
  productUrl: string;
  title: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string;
  cachedImagePath: string | null;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  embeddingModel: string | null;
  predictedTags: string[];
  tagScores: Array<{ tag: string; score: number; prompt: string }>;
  analysis: Record<string, unknown>;
  processingStatus: ProcessingStatus;
  processingAttemptCount: number;
  processingError: string | null;
  scrapedAt: string;
  lastProcessedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScrapedProductInput = {
  retailer: string;
  sourceProductId?: string | null;
  productUrl: string;
  title: string;
  brand?: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  imageUrl: string;
  cachedImagePath?: string | null;
  metadata?: Record<string, unknown>;
  scrapedAt?: string;
};

export type ProductAnalysisInput = {
  embedding: number[];
  embeddingModel: string;
  predictedTags: string[];
  tagScores: Array<{ tag: string; score: number; prompt: string }>;
  analysis: Record<string, unknown>;
};

function buildProductId(retailer: string, productUrl: string): string {
  return `${retailer}#${productUrl}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toProductRecord(raw: Record<string, unknown>): ProductRecord {
  return {
    id: String(raw.id),
    retailer: String(raw.retailer),
    sourceProductId: (raw.sourceProductId as string | null) ?? null,
    productUrl: String(raw.productUrl),
    title: String(raw.title),
    brand: (raw.brand as string | null) ?? null,
    category: (raw.category as string | null) ?? null,
    price: typeof raw.price === "number" ? raw.price : raw.price ? Number(raw.price) : null,
    currency: (raw.currency as string | null) ?? null,
    imageUrl: String(raw.imageUrl),
    cachedImagePath: (raw.cachedImagePath as string | null) ?? null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    embedding: (raw.embedding as number[] | null) ?? null,
    embeddingModel: (raw.embeddingModel as string | null) ?? null,
    predictedTags: (raw.predictedTags as string[]) ?? [],
    tagScores: (raw.tagScores as Array<{ tag: string; score: number; prompt: string }>) ?? [],
    analysis: (raw.analysis as Record<string, unknown>) ?? {},
    processingStatus: (raw.processingStatus as ProcessingStatus) ?? "pending",
    processingAttemptCount: Number(raw.processingAttemptCount ?? 0),
    processingError: (raw.processingError as string | null) ?? null,
    scrapedAt: String(raw.scrapedAt),
    lastProcessedAt: (raw.lastProcessedAt as string | null) ?? null,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}

async function getProductByKey(id: string): Promise<ProductRecord | null> {
  const response = await db.send(
    new GetItemCommand({
      TableName: PRODUCTS_TABLE_NAME,
      Key: marshall({ id }),
    })
  );

  if (!response.Item) {
    return null;
  }

  return toProductRecord(unmarshall(response.Item));
}

export async function upsertScrapedProduct(product: ScrapedProductInput): Promise<ProductRecord> {
  const id = buildProductId(product.retailer, product.productUrl);
  const existing = await getProductByKey(id);
  const timestamp = nowIso();

  const shouldReset =
    !existing ||
    existing.imageUrl !== product.imageUrl ||
    existing.title !== product.title ||
    existing.price !== (product.price ?? null);

  const next: ProductRecord = {
    id,
    retailer: product.retailer,
    sourceProductId: product.sourceProductId ?? null,
    productUrl: product.productUrl,
    title: product.title,
    brand: product.brand ?? null,
    category: product.category ?? null,
    price: product.price ?? null,
    currency: product.currency ?? "USD",
    imageUrl: product.imageUrl,
    cachedImagePath: product.cachedImagePath ?? null,
    metadata: product.metadata ?? {},
    embedding: shouldReset ? null : existing?.embedding ?? null,
    embeddingModel: shouldReset ? null : existing?.embeddingModel ?? null,
    predictedTags: shouldReset ? [] : existing?.predictedTags ?? [],
    tagScores: shouldReset ? [] : existing?.tagScores ?? [],
    analysis: shouldReset ? {} : existing?.analysis ?? {},
    processingStatus: shouldReset ? "pending" : existing?.processingStatus ?? "pending",
    processingAttemptCount: shouldReset ? 0 : existing?.processingAttemptCount ?? 0,
    processingError: shouldReset ? null : existing?.processingError ?? null,
    scrapedAt: product.scrapedAt ?? timestamp,
    lastProcessedAt: shouldReset ? null : existing?.lastProcessedAt ?? null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await db.send(
    new PutItemCommand({
      TableName: PRODUCTS_TABLE_NAME,
      Item: marshall(next, { removeUndefinedValues: true }),
    })
  );

  return next;
}

export async function claimPendingProducts(limit: number): Promise<ProductRecord[]> {
  const scan = await db.send(
    new ScanCommand({
      TableName: PRODUCTS_TABLE_NAME,
      FilterExpression: "processingStatus = :pending OR processingStatus = :failed",
      ExpressionAttributeValues: marshall({
        ":pending": "pending",
        ":failed": "failed",
      }),
      Limit: Math.max(limit * 5, limit),
    })
  );

  const claimed: ProductRecord[] = [];
  const items = (scan.Items ?? []).map((item: Record<string, unknown>) =>
    toProductRecord(unmarshall(item as any))
  );

  for (const item of items) {
    if (claimed.length >= limit) {
      break;
    }

    try {
      const response = await db.send(
        new UpdateItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Key: marshall({ id: item.id }),
          ConditionExpression: "processingStatus = :pending OR processingStatus = :failed",
          UpdateExpression:
            "SET processingStatus = :processing, processingError = :nullValue, updatedAt = :updatedAt ADD processingAttemptCount :attemptInc",
          ExpressionAttributeValues: marshall({
            ":pending": "pending",
            ":failed": "failed",
            ":processing": "processing",
            ":nullValue": null,
            ":updatedAt": nowIso(),
            ":attemptInc": 1,
          }),
          ReturnValues: "ALL_NEW",
        })
      );

      if (response.Attributes) {
        claimed.push(toProductRecord(unmarshall(response.Attributes)));
      }
    } catch {
      // Item may have been claimed by another worker.
    }
  }

  return claimed;
}

export async function markProductProcessed(productId: string, analysis: ProductAnalysisInput): Promise<void> {
  await db.send(
    new UpdateItemCommand({
      TableName: PRODUCTS_TABLE_NAME,
      Key: marshall({ id: productId }),
      UpdateExpression:
        "SET embedding = :embedding, embeddingModel = :embeddingModel, predictedTags = :predictedTags, tagScores = :tagScores, analysis = :analysis, processingStatus = :processed, processingError = :nullValue, lastProcessedAt = :lastProcessedAt, updatedAt = :updatedAt",
      ExpressionAttributeValues: marshall({
        ":embedding": analysis.embedding,
        ":embeddingModel": analysis.embeddingModel,
        ":predictedTags": analysis.predictedTags,
        ":tagScores": analysis.tagScores,
        ":analysis": analysis.analysis,
        ":processed": "processed",
        ":nullValue": null,
        ":lastProcessedAt": nowIso(),
        ":updatedAt": nowIso(),
      }),
    })
  );
}

export async function markProductFailed(productId: string, errorMessage: string): Promise<void> {
  await db.send(
    new UpdateItemCommand({
      TableName: PRODUCTS_TABLE_NAME,
      Key: marshall({ id: productId }),
      UpdateExpression:
        "SET processingStatus = :failed, processingError = :errorMessage, lastProcessedAt = :lastProcessedAt, updatedAt = :updatedAt",
      ExpressionAttributeValues: marshall({
        ":failed": "failed",
        ":errorMessage": errorMessage,
        ":lastProcessedAt": nowIso(),
        ":updatedAt": nowIso(),
      }),
    })
  );
}

export async function findSimilarProductsByEmbedding(
  embedding: number[],
  limit: number
): Promise<ProductRecord[]> {
  const scan = await db.send(
    new ScanCommand({
      TableName: PRODUCTS_TABLE_NAME,
      FilterExpression: "attribute_exists(embedding) AND processingStatus = :processed",
      ExpressionAttributeValues: marshall({
        ":processed": "processed",
      }),
    })
  );

  const rows = (scan.Items ?? [])
    .map((item: Record<string, unknown>) => toProductRecord(unmarshall(item as any)))
    .filter((item: ProductRecord) => Array.isArray(item.embedding) && item.embedding.length === embedding.length)
    .map((item: ProductRecord) => ({
      ...item,
      similarity: cosineSimilarity(embedding, item.embedding as number[]),
    }))
    .sort((a: ProductRecord & { similarity: number }, b: ProductRecord & { similarity: number }) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(({ similarity: _similarity, ...product }: ProductRecord & { similarity: number }) => product);

  return rows;
}

export async function getProductById(productId: string): Promise<ProductRecord | null> {
  return getProductByKey(productId);
}
