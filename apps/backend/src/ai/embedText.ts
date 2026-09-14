import axios from "axios";
import FormData from "form-data";

const EMBED_TEXT_API_URL =
  process.env.EMBED_TEXT_API_URL ?? "http://localhost:8000/embed/text";

export async function getTextEmbedding(
  query: string
): Promise<{ vector: number[]; dim: number }> {
  const form = new FormData();
  form.append("q", query);

  const res = await axios.post(EMBED_TEXT_API_URL, form, {
    headers: form.getHeaders(),
  });

  return res.data as { vector: number[]; dim: number };
}