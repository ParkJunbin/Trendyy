import axios from "axios";

const EMBED_API_URL =
  process.env.EMBED_API_URL ?? "http://localhost:8000/embed/file";
const EMBED_URL_API_URL =
  process.env.EMBED_URL_API_URL ?? "http://localhost:8000/embed/url";

export async function getImageEmbedding(
  input: string // can be a file path OR an S3 presigned URL
): Promise<{ vector: number[]; dim: number }> {

  if (input.startsWith("http")) {
    // Input is an S3 presigned URL — let the worker fetch it directly
    const res = await axios.post(EMBED_URL_API_URL, null, {
      params: { image_url: input },
    });
    return res.data as { vector: number[]; dim: number };
  } else {
    // Input is a local file path (kept for backwards compatibility)
    const fs = await import("fs");
    const path = await import("path");
    const imageBuffer = fs.readFileSync(input);
    const filename = path.basename(input);
    const contentType = mimeFromExt(input) ?? "image/jpeg";

    // Send as multipart form to Python worker
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("file", imageBuffer, {
      filename,
      contentType,
    });

    const res = await axios.post(EMBED_API_URL, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return res.data as { vector: number[]; dim: number };
  }
}

function mimeFromExt(name: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return undefined;
}