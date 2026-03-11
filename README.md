# Trendyy

Phase 1 includes a scraping -> ingestion -> embedding/tag inference -> DB update pipeline using DynamoDB.

## Repo Layout
- `apps/web`: Next.js frontend
- `apps/api`: Express API + ingestion routes + worker scripts
- `packages/scraper`: retailer scrape scripts that push products into API ingestion
- `packages/embedding`: batch trigger script for pending product processing
- `services/inference`: Python FastAPI service (Marqo FashionSigLIP embeddings + zero-shot tags)
- `databases/migrations`: legacy SQL notes (not used in DynamoDB mode)

## Architecture (Phase 1)
1. Scraper extracts product metadata + image URL.
2. Scraper calls `POST /ingest/products` in API.
3. API upserts product items into DynamoDB as `processingStatus='pending'`.
4. Worker claims pending items in batches and calls inference `/analyze-image`.
5. Worker stores embedding, predicted tags, tag scores, and status (`processed` or `failed`).
6. Similarity search is computed in API memory using cosine similarity over stored embeddings (DynamoDB has no native pgvector-style operator).

## DynamoDB Table
Table name: `products` (or `DYNAMODB_PRODUCTS_TABLE`)

Required schema:
- Partition key: `id` (String)

Create/check table with script:
```bash
pnpm db:ensure-table
```

## Environment Variables
Copy `.env.example` to `.env` and adjust values.

Required minimum:
- `AWS_REGION`
- `DYNAMODB_PRODUCTS_TABLE`
- AWS credentials via environment/SSO/profile
- `INFERENCE_SERVICE_URL`

## Setup
1. Install JS dependencies:
```bash
pnpm install
```

2. Ensure DynamoDB table:
```bash
pnpm db:ensure-table
```

3. Start API:
```bash
pnpm api:dev
```

4. Start inference service (new terminal):
```bash
cd services/inference
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Run Ingestion
### Scrape + ingest
```bash
pnpm scraper:iconic
pnpm scraper:universal
```

### Manual ingest test
```bash
curl -X POST http://127.0.0.1:4000/ingest/products \
  -H "Content-Type: application/json" \
  -d "[{\"retailer\":\"manual\",\"productUrl\":\"https://example.com/p1\",\"title\":\"Test Hoodie\",\"imageUrl\":\"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab\",\"price\":59.99}]"
```

## Process Pending Products
### One-shot batch
```bash
pnpm worker:pending:once
```

### Continuous worker
```bash
pnpm worker:pending
```

### Alternative package script
```bash
pnpm embedding:generate
```

## End-to-End Test Script
Analyze one image URL, print embedding length and top tag scores, and save results to DB:
```bash
pnpm pipeline:test-image -- --image-url https://images.unsplash.com/photo-1521572163474-6864f9cf17ab --retailer manual-test --title "Script Test Item"
```

## Inference Service Endpoints
- `POST /embed-image`
- `POST /tag-image`
- `POST /analyze-image`

Payload supports either:
- `image_url` (remote URL)
- `image_path` (local file path)

Optional:
- `top_k` between `3` and `8`

## Common Errors
- `Missing credentials`: configure AWS credentials/profile.
- `ResourceNotFoundException`: DynamoDB table missing; run `pnpm db:ensure-table`.
- `Inference service error`: inference service not running or model load failure.
- `Unsupported content-type`: provided URL did not return an image.
- `No Product JSON-LD entries found`: retailer page format changed; update listing URL or parser.
