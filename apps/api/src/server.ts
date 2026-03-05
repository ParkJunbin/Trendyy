import express, { Request, Response } from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Fashion Trend API running");
});

app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});