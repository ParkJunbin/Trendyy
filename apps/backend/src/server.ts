
import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

import { getImageEmbedding } from "./ai/embedImage";
import { getAllProducts, ProductWithVector } from "./database/products";
import { rankProductsBySimilarity } from "./helper/rank";

const app = express();

app.use(cors());
app.use(express.json());

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

app.get("/", (_req: Request, res: Response) => {
  res.send("Fashion Trend API running");
});

// NEW: return top matches with new product shape
app.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { vector, dim } = await getImageEmbedding(req.file.path);

    const products = (await getAllProducts()) as ProductWithVector[];

    const topMatches = rankProductsBySimilarity(vector, products, 3, true);

    return res.json({
      message: "Upload and recommendation successful",
      filename: req.file.filename,
      topMatches,
      queryDim: dim, // optional: useful for debugging
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Recommendation failed" });
  }
});

app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});
