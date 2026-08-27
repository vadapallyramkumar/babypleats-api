import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

type Seed = {
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    image: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
    filter?: string | null;
  }>;
  products: Array<{
    id: string;
    slug: string;
    name: string;
    categoryId: string;
    subcategory?: string | null;
    description: string;
    fabric?: string | null;
    care: string[];
    images: string[];
    colorGalleries?: Array<{ color: string; images: string[] }>;
    variants: unknown[];
    isNew: boolean;
    featured: boolean;
    isActive: boolean;
    rating?: number;
    reviewsCount?: number;
    tags: string[];
    createdAt?: string;
    updatedAt?: string;
  }>;
};

async function main() {
  const seedPath = path.join(__dirname, "seed-data.json");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8")) as Seed;

  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  for (const c of seed.categories) {
    await prisma.category.create({
      data: {
        id: c.id,
        slug: c.slug,
        name: c.name,
        image: c.image,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        filter: c.filter ?? null,
      },
    });
  }

  for (const p of seed.products) {
    await prisma.product.create({
      data: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        categoryId: p.categoryId,
        subcategory: p.subcategory ?? null,
        description: p.description,
        fabric: p.fabric ?? null,
        care: JSON.stringify(p.care ?? []),
        images: JSON.stringify(p.images),
        colorGalleries: JSON.stringify(p.colorGalleries ?? []),
        variants: JSON.stringify(p.variants),
        isNew: p.isNew,
        featured: p.featured,
        isActive: p.isActive,
        rating: p.rating ?? null,
        reviewsCount: p.reviewsCount ?? null,
        tags: JSON.stringify(p.tags ?? []),
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
      },
    });
  }

  console.log(
    `Seeded ${seed.categories.length} categories, ${seed.products.length} products`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
