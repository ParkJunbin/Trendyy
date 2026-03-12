import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { cosineSimilarity } from "./similarity";
import { getImageEmbedding } from "./ai/embedImage";
import { getAllProducts } from "./database/products";

const app = express();

app.use(cors());
app.use(express.json());

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.get("/", (_req: Request, res: Response) => {
  res.send("Fashion Trend API running");
});

app.post("/upload", upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // generate embedding for uploaded image
    const queryEmbedding = await getImageEmbedding(req.file.path);

    // fetch products from DynamoDB
    const products = await getAllProducts();

    const scoredProducts = products.map((product) => ({
      ...product,
      similarity: cosineSimilarity(queryEmbedding, product.embedding),
    }));

    scoredProducts.sort((a, b) => b.similarity - a.similarity);

    return res.json({
      message: "Upload and recommendation successful",
      filename: req.file.filename,
      topMatches: scoredProducts.slice(0, 3),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Recommendation failed",
    });
  }
});


app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});