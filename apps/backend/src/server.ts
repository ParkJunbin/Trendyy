import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";

import { getImageEmbedding } from "./ai/embedImage";
import { getImageTags } from "./ai/tagImage";
import { getAllProducts, ProductWithVector, saveProduct } from "./database/dynamodb/products";
import { rankProductsBySimilarity } from "./helper/rank";
import { uploadToS3, getPresignedUrl } from "./database/s3/s3";

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

app.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const tagThreshold = Number(req.body?.threshold ?? 0.6);
    const tagResult = await getImageTags(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      tagThreshold
    );
    const detectedCategoryTags = (tagResult.tags.category ?? []).map((item) => item.tag);
    const detectedColorTags = (tagResult.tags.color ?? []).map((item) => item.tag);
    const detectedMaterialTags = (tagResult.tags.material ?? []).map((item) => item.tag);
    const combinedTags = [
      ...detectedCategoryTags,
      ...detectedColorTags,
      ...detectedMaterialTags,
    ];
    const uniqueTags = [...new Set(combinedTags)];
    const categoryFromTags = uniqueTags.join(", ");

    // 1. Upload image to S3
    const key = `uploads/${Date.now()}-${req.file.originalname}`;
    const imageUrl = await uploadToS3(req.file.buffer, key, req.file.mimetype);

    // 2. Generate a presigned URL so the embed model can read the image
    const signedUrl = await getPresignedUrl(key);

    // 3. Generate embedding using the signed S3 URL
    const { vector, dim } = await getImageEmbedding(signedUrl);

    // 4. Save product (with vector + dim) to DynamoDB
    const product: ProductWithVector = {
      id: Date.now(), // or use uuid/ulid
      title: (req.body?.title ?? req.file.originalname) as string,
      brand: (req.body?.brand ?? "") as string,
      category: (categoryFromTags || req.body?.category || "") as string,
      price: Number(req.body?.price ?? 0),
      imagePath: imageUrl,   // store the permanent public S3 URL

      vector,
      dim,
      normalized: true,      // your worker returns normalized embeddings
    };

    await saveProduct(product);


    // 5. Fetch products and rank by similarity
    const products = (await getAllProducts()) as ProductWithVector[];
    const topMatches = rankProductsBySimilarity(vector, products, 3, true);

    return res.json({
      message: "Upload and recommendation successful",
      filename: key,
      topMatches,
      queryDim: dim,
      tags: tagResult.tags,
      tagThreshold: tagResult.threshold,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Recommendation failed" });
  }
});

app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});