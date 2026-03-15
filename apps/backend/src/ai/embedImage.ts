
import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios from "axios";

const EMBED_API_URL =
  process.env.EMBED_API_URL ?? "http://localhost:8000/embed/file";

export async function getImageEmbedding(
  filePath: string
): Promise<{ vector: number[]; dim: number }> {
  const form = new FormData();

  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: mimeFromExt(filePath) ?? "application/octet-stream",
  });

  const res = await axios.post(EMBED_API_URL, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return res.data as { vector: number[]; dim: number };
}

function mimeFromExt(name: string): string | undefined {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return undefined;
}
