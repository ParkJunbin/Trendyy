from __future__ import annotations

import io
import os
from functools import lru_cache
from typing import Annotated, Literal

import requests
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, model_validator
from PIL import Image, UnidentifiedImageError
from transformers import AutoModel, AutoProcessor

from .taxonomy import build_tag_prompts


MODEL_ID = os.getenv("INFERENCE_MODEL_ID", "Marqo/marqo-fashionSigLIP")
MAX_IMAGE_BYTES = int(os.getenv("INFERENCE_MAX_IMAGE_BYTES", "10485760"))
DOWNLOAD_TIMEOUT_SECONDS = float(os.getenv("INFERENCE_DOWNLOAD_TIMEOUT_SECONDS", "12"))
DEFAULT_TOP_K = int(os.getenv("INFERENCE_DEFAULT_TOP_K", "5"))
MIN_TOP_K = 3
MAX_TOP_K = 8


class AnalyzeImageRequest(BaseModel):
    image_url: str | None = None
    image_path: str | None = None
    top_k: Annotated[int | None, Field(ge=MIN_TOP_K, le=MAX_TOP_K)] = None

    @model_validator(mode="after")
    def validate_source(self) -> "AnalyzeImageRequest":
        if not self.image_url and not self.image_path:
            raise ValueError("One of image_url or image_path is required")
        return self


class TagScore(BaseModel):
    tag: str
    score: float
    prompt: str


class EmbedImageResponse(BaseModel):
    model_id: str
    embedding: list[float]


class TagImageResponse(BaseModel):
    model_id: str
    predicted_tags: list[str]
    tag_scores: list[TagScore]


class AnalyzeImageResponse(BaseModel):
    model_id: str
    embedding: list[float]
    predicted_tags: list[str]
    tag_scores: list[TagScore]


app = FastAPI(title="Fashion Inference Service", version="0.1.0")


@lru_cache(maxsize=1)
def get_model_components() -> tuple[AutoProcessor, AutoModel]:
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID)
    model.eval()
    return processor, model


@lru_cache(maxsize=1)
def get_tag_prompts() -> tuple[list[str], list[str]]:
    prompts = build_tag_prompts()
    tags = [item.tag for item in prompts]
    texts = [item.prompt for item in prompts]
    return tags, texts


@lru_cache(maxsize=1)
def get_text_embeddings() -> tuple[list[str], list[str], torch.Tensor]:
    processor, model = get_model_components()
    tags, prompts = get_tag_prompts()

    inputs = processor(text=prompts, padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        text_features = torch.nn.functional.normalize(text_features, p=2, dim=-1)

    return tags, prompts, text_features


def _open_remote_image(url: str) -> Image.Image:
    try:
        response = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS, stream=True)
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {exc}") from exc

    content_type = response.headers.get("content-type", "")
    if "image" not in content_type.lower():
        raise HTTPException(status_code=400, detail=f"Unsupported content-type: {content_type}")

    content = io.BytesIO()
    total_read = 0

    for chunk in response.iter_content(chunk_size=8192):
        if not chunk:
            continue
        total_read += len(chunk)
        if total_read > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="Image exceeds maximum size limit")
        content.write(chunk)

    try:
        content.seek(0)
        return Image.open(content).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Downloaded file is not a valid image") from exc


def _open_local_image(image_path: str) -> Image.Image:
    normalized = os.path.abspath(image_path)
    if not os.path.isfile(normalized):
        raise HTTPException(status_code=400, detail=f"image_path does not exist: {normalized}")

    try:
        return Image.open(normalized).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Local file is not a valid image") from exc


def load_image(payload: AnalyzeImageRequest) -> Image.Image:
    if payload.image_url:
        return _open_remote_image(payload.image_url)

    assert payload.image_path is not None
    return _open_local_image(payload.image_path)


def embed_pil_image(image: Image.Image) -> list[float]:
    processor, model = get_model_components()
    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        image_features = torch.nn.functional.normalize(image_features, p=2, dim=-1)

    return image_features[0].tolist()


def get_top_tags(embedding: list[float], top_k: int) -> list[TagScore]:
    tags, prompts, text_embeddings = get_text_embeddings()
    image_tensor = torch.tensor(embedding).unsqueeze(0)
    image_tensor = torch.nn.functional.normalize(image_tensor, p=2, dim=-1)

    similarities = torch.matmul(image_tensor, text_embeddings.T)[0]
    values, indices = torch.topk(similarities, k=top_k)

    results: list[TagScore] = []
    for score, idx in zip(values.tolist(), indices.tolist()):
        results.append(TagScore(tag=tags[idx], score=float(score), prompt=prompts[idx]))

    return results


@app.get("/health")
def health() -> dict[str, Literal["ok"]]:
    return {"status": "ok"}


@app.post("/embed-image", response_model=EmbedImageResponse)
def embed_image(payload: AnalyzeImageRequest) -> EmbedImageResponse:
    image = load_image(payload)
    embedding = embed_pil_image(image)
    return EmbedImageResponse(model_id=MODEL_ID, embedding=embedding)


@app.post("/tag-image", response_model=TagImageResponse)
def tag_image(payload: AnalyzeImageRequest) -> TagImageResponse:
    image = load_image(payload)
    embedding = embed_pil_image(image)
    top_k = payload.top_k or DEFAULT_TOP_K
    tags = get_top_tags(embedding, top_k)

    return TagImageResponse(
        model_id=MODEL_ID,
        predicted_tags=[tag.tag for tag in tags],
        tag_scores=tags,
    )


@app.post("/analyze-image", response_model=AnalyzeImageResponse)
def analyze_image(payload: AnalyzeImageRequest) -> AnalyzeImageResponse:
    image = load_image(payload)
    embedding = embed_pil_image(image)
    top_k = payload.top_k or DEFAULT_TOP_K
    tags = get_top_tags(embedding, top_k)

    return AnalyzeImageResponse(
        model_id=MODEL_ID,
        embedding=embedding,
        predicted_tags=[tag.tag for tag in tags],
        tag_scores=tags,
    )
