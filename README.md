# Baby Pleats API

Catalog API (NestJS + Prisma + PostgreSQL) for **products and categories**.

## Endpoints

API base: [http://localhost:4000/v1](http://localhost:4000/v1)

### Public (no auth)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness (no `/v1` prefix) |
| `GET` | `/v1` | API info |
| `GET` | `/v1/categories` | Active categories |
| `GET` | `/v1/products` | Active products (paginated) |
| `GET` | `/v1/products/:slug` | Product detail |

### Writes (API key required)

Send `Authorization: Bearer <API_WRITE_KEY>` or `X-API-Key: <API_WRITE_KEY>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/categories` | Create category |
| `PUT` / `PATCH` | `/v1/categories/:id` | Update category |
| `DELETE` | `/v1/categories/:id` | Soft-delete category (`isActive: false`) |
| `POST` | `/v1/products` | Create product |
| `PUT` / `PATCH` | `/v1/products/:id` | Update product |
| `DELETE` | `/v1/products/:id` | Soft-delete product (`isActive: false`) |

Product query params: `category`, `featured`, `isNew`, `tag`, `q`, `page`, `limit`.

Merchandising categories (`filter`): `budgetFriendly`, `readyToDispatch`, `bestseller`.

Deletes are soft. Category delete fails if it still has active products.

## Local setup

```bash
cp .env.example .env
docker compose up postgres -d
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

Set a strong `API_WRITE_KEY` before using write endpoints.

## Docker

```bash
docker compose up --build
```

## Deploy (Railway / Render)

1. PostgreSQL + `DATABASE_URL`
2. `PORT`, `CORS_ORIGIN`, `API_WRITE_KEY`
3. Health check: `/health`
4. Deploy; image runs `prisma migrate deploy` then `node dist/main.js` (does **not** seed)
5. Seed once manually when needed: `npm run prisma:seed`
6. Storefront: `NEXT_PUBLIC_API_BASE_URL=https://api.babypleats.com/v1`
