# Baby Pleats API

Public catalog API (NestJS + Prisma + PostgreSQL). Storefront contract: [`docs/openapi.yaml`](../babypleates/docs/openapi.yaml) — **products and categories only**.

## Endpoints

API base: [http://localhost:4000/v1](http://localhost:4000/v1)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness (no `/v1` prefix) |
| `GET` | `/v1` | API info |
| `GET` | `/v1/categories` | Active categories (`sortOrder`) |
| `GET` | `/v1/products` | Active products (paginated) |
| `GET` | `/v1/products/:slug` | Product detail |

Product query params: `category`, `featured`, `isNew`, `tag`, `q`, `page`, `limit`.

Merchandising categories (`filter` on the category): `budgetFriendly`, `readyToDispatch`, `bestseller` resolve to tag/featured filters instead of `categoryId`.

Admin, auth, media, orders, and site settings are not included in this release.

## Local setup

1. Copy env and start Postgres:

```bash
cp .env.example .env
docker compose up postgres -d
```

2. Install, migrate, seed, run:

```bash
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

Default admin-free catalog comes from `prisma/seed-data.json`.

## Docker (API + Postgres)

```bash
docker compose up --build
```

On start the API runs migrations and reseeds the catalog from `prisma/seed-data.json`.

## Deploy (Railway / Render)

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `PORT` (the app reads it; default `4000`), `CORS_ORIGIN` (include the storefront origin, e.g. GitHub Pages).
3. Health check path: `/health`.
4. Deploy this repo. The image runs `prisma migrate deploy`, then seeds, then `node dist/main.js`.
5. Point `api.babypleats.com` at the service and set storefront `NEXT_PUBLIC_API_BASE_URL=https://api.babypleats.com/v1`.

Do not use SQLite in production. Catalog images in seed data are storefront-relative paths (e.g. `/images/...`); serve those from the storefront or a CDN.

## Refresh seed from storefront catalog

From the storefront repo:

```bash
npx tsx scripts/export-catalog-seed.ts
cd ../babypleats-api && npm run prisma:seed
```
