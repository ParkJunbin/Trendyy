import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeImage } from "./ai/inferenceClient";
import {
  claimPendingProducts,
  findSimilarProductsByEmbedding,
  upsertScrapedProduct,
} from "./database/products";
import { processProduct } from "./pipeline/processProduct";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, uploadDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Fashion Trend API running",
  });
});

app.post("/ingest/products", async (req: Request, res: Response) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];

  if (!payload.length) {
    return res.status(400).json({ message: "Request body must include at least one product." });
  }

  const records = [];

  for (const item of payload) {
    if (!item?.retailer || !item?.productUrl || !item?.title || !item?.imageUrl) {
      return res.status(400).json({
        message: "Each product must include retailer, productUrl, title, imageUrl.",
      });
    }

    const record = await upsertScrapedProduct({
      retailer: item.retailer,
      sourceProductId: item.sourceProductId ?? null,
      productUrl: item.productUrl,
      title: item.title,
      brand: item.brand ?? null,
      category: item.category ?? null,
      price: item.price ?? null,
      currency: item.currency ?? "USD",
      imageUrl: item.imageUrl,
      cachedImagePath: item.cachedImagePath ?? null,
      metadata: item.metadata ?? {},
      scrapedAt: item.scrapedAt ?? undefined,
    });

    records.push(record);
  }

  return res.json({
    message: "Products ingested successfully",
    count: records.length,
    products: records,
  });
});

app.post("/process/pending", async (req: Request, res: Response) => {
  const batchSize = Number(req.body?.batchSize ?? process.env.PROCESSING_BATCH_SIZE ?? 10);
  const pending = await claimPendingProducts(batchSize);

  for (const product of pending) {
    await processProduct(product);
  }

  return res.json({
    message: "Pending product processing complete",
    claimed: pending.length,
  });
});

app.post("/upload", upload.single("image"), async (req: Request & { file?: any }, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Uploaded images are analyzed directly by the local inference service.
    const analysis = await analyzeImage({
      image_path: req.file.path,
      top_k: Number(process.env.FASHION_TAG_TOP_K ?? 5),
    });

    const topMatches = await findSimilarProductsByEmbedding(analysis.embedding, 3);

    return res.json({
      message: "Upload and recommendation successful",
      filename: req.file.filename,
      predictedTags: analysis.predicted_tags,
      tagScores: analysis.tag_scores,
      topMatches,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Recommendation failed",
    });
  }
});

const port = Number(process.env.API_PORT ?? 4000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
