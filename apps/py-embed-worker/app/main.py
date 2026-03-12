
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


# -------------------------------
# Endpoints
# -------------------------------
@app.get("/")
def root():
    return {"ok": True, "message": "FashionSigLIP worker is running"}



@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_ID}


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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
