import axios from "axios";
import FormData from "form-data";

const PY_WORKER_BASE_URL = process.env.PY_WORKER_URL ?? "http://localhost:8000";
const TAG_API_URL = `${PY_WORKER_BASE_URL.replace(/\/$/, "")}/tag/file`;
const MAX_TAG_IMAGE_BYTES = Number(process.env.TAG_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024);

export type TagScore = {
  tag: string;
  score: number;
};

export type TagsResponse = {
  category?: TagScore[];
  color?: TagScore[];
  material?: TagScore[];
};

export async function getImageTags(
  imageBuffer: Buffer,
  filename: string,
  contentType: string,
  threshold = 0.6
): Promise<{ tags: TagsResponse; threshold: number }> {
  const form = new FormData();
  form.append("file", imageBuffer, {
    filename,
    contentType,
  });
  form.append("threshold", String(threshold));

  const res = await axios.post(TAG_API_URL, form, {
    headers: form.getHeaders(),
    maxBodyLength: MAX_TAG_IMAGE_BYTES,
    maxContentLength: MAX_TAG_IMAGE_BYTES,
  });

  return res.data as { tags: TagsResponse; threshold: number };
}
