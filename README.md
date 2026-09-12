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

### Auth

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/auth/login` | `{ "email", "password" }` → `{ data: { accessToken, expiresIn, user } }` |
| `GET` | `/v1/auth/me` | Current admin (`Authorization: Bearer <accessToken>`) |
| `POST` | `/v1/auth/logout` | Client logout (`204`; JWT is stateless) |

Owner account is created on boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / optional `ADMIN_NAME` only if that email does not already exist (password is never overwritten on later startups). Login is rate-limited to 5 attempts per IP per minute.

### Writes (JWT)

Send `Authorization: Bearer <accessToken>` from admin login.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/categories` | Create category |
| `PUT` / `PATCH` | `/v1/categories/:id` | Update category |
| `DELETE` | `/v1/categories/:id` | Permanently delete category (fails if any products still reference it) |
| `POST` | `/v1/products` | Create product |
| `PUT` / `PATCH` | `/v1/products/:id` | Update product |
| `DELETE` | `/v1/products/:id` | Permanently delete product |
| `POST` | `/v1/home/hero-images` | Create hero image |
| `PUT` / `PATCH` | `/v1/home/hero-images/:id` | Update hero image |
| `DELETE` | `/v1/home/hero-images/:id` | Delete hero image |
| `POST` | `/v1/home/promotional-messages` | Create promo message |
| `PUT` / `PATCH` | `/v1/home/promotional-messages/:id` | Update promo message |
| `DELETE` | `/v1/home/promotional-messages/:id` | Delete promo message |
| `POST` | `/v1/home/social-links` | Create social link |
| `PUT` / `PATCH` | `/v1/home/social-links/:id` | Update social link |
| `DELETE` | `/v1/home/social-links/:id` | Delete social link |
| `POST` | `/v1/media/upload` | Upload image or video (`multipart/form-data` field `file`) → Cloudinary. Allowed: jpeg/png/webp/gif (≤10MB), mp4/webm/mov (≤50MB). Content is checked via magic bytes. |
| `DELETE` | `/v1/media` | Delete media (`{ "publicId": "...", "resourceType": "image"|"video" }` — `resourceType` optional, defaults to `image`) |

Product query params: `category`, `featured`, `isNew`, `tag`, `q`, `page`, `limit`.

Merchandising categories (`filter`): `budgetFriendly`, `readyToDispatch`, `bestseller`.

To hide a category or product without deleting, set `isActive: false` via PATCH. `DELETE` permanently removes the record. Home content is the same (use `active: false` via PATCH to hide).

Social link `type`: `image` or `video`.

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

Set `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` before starting.

## Docker

```bash
docker compose up --build
```

## Deploy (Railway / Render)

1. PostgreSQL + `DATABASE_URL`
2. `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (optional `ADMIN_NAME`, `JWT_EXPIRES_IN`, `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`)
3. Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET` (optional `CLOUDINARY_FOLDER`)
4. Health check: `/health`
5. Deploy; image runs `prisma migrate deploy` then `node dist/main.js` (does **not** seed catalog; admin owner is created on first boot from env if missing)
6. Seed catalog once manually when needed: `npm run prisma:seed`
7. Storefront: `NEXT_PUBLIC_API_BASE_URL=https://api.babypleats.com/v1`
