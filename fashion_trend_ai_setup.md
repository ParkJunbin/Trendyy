
# Fashion Trend AI – Project Setup Guide

This document explains how to set up the **Fashion Trend AI system** so all team members can run the project locally and contribute.

The goal of V1 is to create a working pipeline:

Scrape fashion products → Store data → Generate embeddings → Image search → Return similar products

---

# 1. Project Structure

Recommended repository structure:

fashion-trend-ai/
│
├── apps/
│   ├── web/           # Frontend (React / Next.js)
│   └── api/           # Backend API (Node / Express / Next API)
│
├── packages/
│   ├── scraper/       # Web scraping jobs
│   ├── embedding/     # CLIP embedding generation
│   └── shared/        # Shared types / utilities
│
├── database/
│   ├── migrations/    # DB schema migrations
│   └── schema.sql
│
├── scripts/           # Utility scripts
│
├── .env.example       # Environment variables template
├── .gitignore
├── package.json
└── README.md

---

# 2. Prerequisites

Install the following:

- Node.js (v18+)
- pnpm (recommended) or npm
- Docker (for local database)
- Git

Check installation:

node -v
pnpm -v
docker -v

---

# 3. Environment Setup

Create a `.env` file based on `.env.example`.

Example:

DATABASE_URL=postgres://postgres:postgres@localhost:5432/fashion_ai
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
OPENAI_API_KEY=
EMBEDDING_MODEL=clip-vit-base

---

# 4. Database Setup

We use PostgreSQL + pgvector for vector similarity search.

Start Postgres locally using Docker:

docker run -d \
  --name fashion-db \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=fashion_ai \
  ankane/pgvector

Run migrations:

pnpm db:migrate

---

# 5. Database Schema

Core tables:

products

id  
title  
brand  
price  
category  
product_url  
image_url  
retailer  
created_at  

product_images

id  
product_id  
image_url  
image_hash  

product_embeddings

id  
product_id  
embedding vector  
model  
created_at  

price_history (optional)

id  
product_id  
price  
timestamp  

---

# 6. Scraper Setup

The scraper collects product data from retailers such as:

- The Iconic
- Universal Store
- Glue Store

Example command:

pnpm scraper:iconic

The scraper should extract:

- Product title
- Price
- Category
- Brand
- Image URL
- Product page URL

The scraper inserts results into the `products` table.

Deduplication should use:

product_url (unique)

---

# 7. Embedding Pipeline

After products are stored, we generate image embeddings.

Steps:

1. Download product image
2. Generate embedding using CLIP / ViT
3. Store embedding vector in database

Example command:

pnpm embeddings:generate

Embedding table uses pgvector to enable similarity search.

---

# 8. API Endpoints

Minimum API endpoints:

POST /search/image

Process:

1. User uploads image
2. Image converted to embedding
3. Vector similarity search
4. Return top matching products

GET /products/:id

Returns:

title  
brand  
price  
retailer  
image  
product_url  

---

# 9. Frontend (Web App)

Frontend features:

Image Upload  
User uploads image to search for fashion items.

Search Results  
Return product cards showing:

- Image
- Product name
- Price
- Brand
- Retailer
- Link to product page

Optional Filters

- Retailer
- Category
- Price range

---

# 10. User Accounts (Future Feature)

Account system will allow:

- Search history tracking
- Saved items
- Personalized recommendations

Possible tools:

- NextAuth
- Clerk
- Firebase Auth

Example table:

search_history

user_id  
query_image  
results_clicked  
timestamp  

---

# 11. GitHub Collaboration

Clone repo:

git clone <repo-url>

Install dependencies:

pnpm install

Start development:

pnpm dev

Create feature branch:

git checkout -b feature/your-feature

Push changes:

git push origin feature/your-branch

Open a Pull Request.

---

# 12. CI (Recommended)

Set up GitHub Actions to run:

pnpm lint  
pnpm typecheck  
pnpm test  

---

# 13. Deployment (Later Phase)

Suggested stack:

Frontend → Vercel  
Backend → Render / Fly.io / Railway  
Database → Supabase / Railway  
Scraping Jobs → GitHub Actions Cron

---

# 14. V1 Milestone

To reach the first working version:

1. Postgres + pgvector running
2. One scraper working
3. Products stored in DB
4. Embeddings generated
5. `/search/image` API implemented
6. Frontend image upload working
7. Results displayed as product cards

Once these are complete, the image → fashion recommendation pipeline works.
