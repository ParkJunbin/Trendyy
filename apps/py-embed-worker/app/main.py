
import io
import os
import requests
import torch
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from PIL import Image
import uvicorn

# NEW: OpenCLIP imports
import open_clip

# -------------------------------
# Model load (once at startup)
# -------------------------------
MODEL_ID = "Marqo/marqo-fashionSigLIP"


CATEGORY_TAGS = [
    "t-shirt",
    "dress",
    "jacket",
    "pants",
    "skirt",
    "sneakers",
    "heels"
]

COLOR_TAGS = [
    "black",
    "white",
    "red",
    "blue",
    "green",
    "brown",
    "beige"
]

MATERIAL_TAGS = [
    "cotton",
    "denim",
    "leather",
    "silk",
    "wool",
    "polyester"
]


try:
    # Create model and preprocessing transforms directly from the HF Hub
    # (as per the model card)
    # model: nn.Module 
    # preprocess_train / preprocess_val: torchvision-like transforms
    model, preprocess_train, preprocess_val = open_clip.create_model_and_transforms(
        f"hf-hub:{MODEL_ID}"
    )
    tokenizer = open_clip.get_tokenizer(f"hf-hub:{MODEL_ID}")

    # Inference mode
    model.eval()

    # Optional: choose device if you have CUDA
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(DEVICE)

except Exception as e:
    raise RuntimeError(f"Failed to load model {MODEL_ID}: {e}")

app = FastAPI(title="FashionSigLIP Worker (OpenCLIP)", version="1.0.0")


# -------------------------------
# Helpers
# -------------------------------
def _embed_pil(img: Image.Image):
    """
    Preprocess a PIL image and return its normalized embedding as a Python list.
    """
    with torch.inference_mode():
        pixel = preprocess_val(img).unsqueeze(0).to(DEVICE)  # (1, C, H, W)
        feats = model.encode_image(pixel, normalize=True)    # (1, D)
    return feats.squeeze(0).cpu().numpy().tolist()


def _embed_text(text: str):
    """
    Tokenize a single string and return its normalized embedding as a Python list.
    """
    with torch.inference_mode():
        tokens = tokenizer([text]).to(DEVICE)                # (1, L)
        feats = model.encode_text(tokens, normalize=True)    # (1, D)
    return feats.squeeze(0).cpu().numpy().tolist()

# compares image with tags
def _score_image_against_texts(
    img: Image.Image,
    candidate_texts: list[str]
):
    """
    Returns list of (text, score) using softmax-normalized similarity.
    """
    with torch.inference_mode():
        image_tensor = preprocess_val(img).unsqueeze(0).to(DEVICE)
        image_feat = model.encode_image(image_tensor, normalize=True)  # (1, D)

        text_tokens = tokenizer(candidate_texts).to(DEVICE)
        text_feat = model.encode_text(text_tokens, normalize=True)  # (N, D)

        # cosine similarity → softmax
        scores = (image_feat @ text_feat.T).squeeze(0)
        probs = (scores * 100.0).softmax(dim=-1)

    return [
        {"tag": t, "score": float(p)}
        for t, p in zip(candidate_texts, probs.cpu())
    ]

def _auto_tag_image(
    img: Image.Image,
    threshold: float = 0.6
):
    """
    Run zero-shot tagging across all tag groups.
    """
    results = {}

    tag_groups = {
        "category": CATEGORY_TAGS,
        "color": COLOR_TAGS,
        "material": MATERIAL_TAGS,
    }

    for group, tags in tag_groups.items():
        scored = _score_image_against_texts(img, tags)
        results[group] = [
            s for s in scored if s["score"] >= threshold
        ]

    return results



# -------------------------------
# Endpoints
# -------------------------------
@app.get("/")
def root():
    return {"ok": True, "message": "FashionSigLIP worker is running"}



@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_ID}


#-------------------------------------------
# returns {vector, dimension} of the image
#-------------------------------------------
# for url input
@app.post("/embed/url")
def embed_from_url(image_url: str):
    try:
        r = requests.get(image_url, timeout=10)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
        vec = _embed_pil(img)
        return {"vector": vec, "dim": len(vec)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# for file input
@app.post("/embed/file")
async def embed_from_upload(file: UploadFile = File(...)):
    try:
        img = Image.open(io.BytesIO(await file.read())).convert("RGB")
        vec = _embed_pil(img)
        return {"vector": vec, "dim": len(vec)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# for text input
@app.post("/embed/text")
def embed_text(q: str = Form(...)):
    try:
        vec = _embed_text(q)
        return {"vector": vec, "dim": len(vec)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    

@app.post("/tag/file")
async def tag_from_upload(
    file: UploadFile = File(...),
    threshold: float = Form(0.6)
):
    try:
        img = Image.open(io.BytesIO(await file.read())).convert("RGB")
        tags = _auto_tag_image(img, threshold)
        return {
            "tags": tags,
            "threshold": threshold
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/tag/url")
def tag_from_url(
    image_url: str = Form(...),
    threshold: float = Form(0.6)
):
    try:
        r = requests.get(image_url, timeout=10)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("RGB")

        tags = _auto_tag_image(img, threshold)
        return {
            "tags": tags,
            "threshold": threshold
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
