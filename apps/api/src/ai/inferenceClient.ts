export type TagScore = {
  tag: string;
  score: number;
  prompt: string;
};

export type AnalyzeImageResponse = {
  model_id: string;
  embedding: number[];
  predicted_tags: string[];
  tag_scores: TagScore[];
};

export type AnalyzeImageRequest = {
  image_url?: string;
  image_path?: string;
  top_k?: number;
};

const defaultInferenceUrl = "http://127.0.0.1:8000";

function getInferenceBaseUrl(): string {
  return process.env.INFERENCE_SERVICE_URL ?? defaultInferenceUrl;
}

export async function analyzeImage(request: AnalyzeImageRequest): Promise<AnalyzeImageResponse> {
  const timeoutMs = Number(process.env.INFERENCE_TIMEOUT_MS ?? 25000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getInferenceBaseUrl()}/analyze-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inference service error (${response.status}): ${text}`);
    }

    return (await response.json()) as AnalyzeImageResponse;
  } finally {
    clearTimeout(timeout);
  }
}
