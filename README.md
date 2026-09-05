# Baby Pleats API

Catalog + home CMS API (NestJS + Prisma + PostgreSQL) for **products, categories, and homepage content**.

## Endpoints

API base: [http://localhost:4000/v1](http://localhost:4000/v1)

### Public (no auth)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness (no `/v1` prefix) |
| `GET` | `/v1` | API info |
| `GET` | `/v1/categories` | Categories (active only; `?includeInactive=true` for all) |
| `GET` | `/v1/products` | Products paginated (active only; `?includeInactive=true` for all) |
| `GET` | `/v1/products/:slug` | Product detail (active only; `?includeInactive=true` allows inactive) |
| `GET` | `/v1/home/hero-images` | Hero banners (active only; `?includeInactive=true` for all) |
| `GET` | `/v1/home/hero-images/:id` | Hero banner by id |
| `GET` | `/v1/home/promotional-messages` | Promo ticker messages |
| `GET` | `/v1/home/promotional-messages/:id` | Promo message by id |
| `GET` | `/v1/home/social-links` | Social media links |
| `GET` | `/v1/home/social-links/:id` | Social link by id |

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
| `POST` | `/v1/home/hero-images` | Create hero image |
| `PATCH` | `/v1/home/hero-images/:id` | Update hero image |
| `DELETE` | `/v1/home/hero-images/:id` | Delete hero image |
| `POST` | `/v1/home/promotional-messages` | Create promo message |
| `PATCH` | `/v1/home/promotional-messages/:id` | Update promo message |
| `DELETE` | `/v1/home/promotional-messages/:id` | Delete promo message |
| `POST` | `/v1/home/social-links` | Create social link (one per platform) |
| `PATCH` | `/v1/home/social-links/:id` | Update social link |
| `DELETE` | `/v1/home/social-links/:id` | Delete social link |
| `POST` | `/v1/media/upload` | Upload image (`multipart/form-data` field `file`) → Cloudinary |
| `DELETE` | `/v1/media` | Delete image (`{ "publicId": "..." }` from upload response) |

Product query params: `category`, `featured`, `isNew`, `tag`, `q`, `page`, `limit`.

Merchandising categories (`filter`): `budgetFriendly`, `readyToDispatch`, `bestseller`.

Catalog deletes are soft. Home content deletes are hard (use `active: false` via PATCH to hide without deleting).

Social platforms: `instagram`, `facebook`, `youtube`, `whatsapp`, `twitter`.

### Home response shape

```json
{
  "success": true,
  "data": [],
  "message": "Hero images fetched successfully"
}
```

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
3. Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET` (optional `CLOUDINARY_FOLDER`)
4. Health check: `/health`
5. Deploy; image runs `prisma migrate deploy` then `node dist/main.js` (does **not** seed)
6. Seed once manually when needed: `npm run prisma:seed`
7. Storefront: `NEXT_PUBLIC_API_BASE_URL=https://api.babypleats.com/v1`
