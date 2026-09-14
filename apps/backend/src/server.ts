import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";

import { getTextEmbedding } from "./ai/embedText";
import { getImageTags } from "./ai/tagImage";
import { processUploadedProduct } from "./database/dynamodb/uploadProduct";
import {
  getAllProducts,
  searchProductsByEmbedding,
} from "./database/dynamodb/products";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Memory storage — file goes straight to S3, not disk
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (_req: Request, res: Response) => {
  res.send("Fashion Trend API running");
});

app.post("/tag/file", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const threshold = Number(req.body?.threshold ?? 0.6);
    const tags = await getImageTags(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      threshold
    );

    return res.json(tags);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: "Tagging failed" });
  }
});

app.get("/search", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q ?? "").trim();

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const { vector, dim } = await getTextEmbedding(query);
    const products = await getAllProducts();
    const matches = searchProductsByEmbedding(vector, products);

    return res.json({ query, queryDim: dim, matches });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Search failed" });
  }
});

app.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const uploadResult = await processUploadedProduct({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      title: req.body?.title,
      brand: req.body?.brand,
      category: req.body?.category,
      price: req.body?.price,
      tagThreshold: Number(req.body?.threshold ?? 0.6),
    });

    return res.json(uploadResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Recommendation failed" });
  }
});

app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});