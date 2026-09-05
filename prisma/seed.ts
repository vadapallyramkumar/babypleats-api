import { PrismaClient, SocialPlatform } from "@prisma/client";
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
  await prisma.heroImage.deleteMany();
  await prisma.promotionalMessage.deleteMany();
  await prisma.socialLink.deleteMany();

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

  const heroImages = [
    {
      url: "https://res.cloudinary.com/demo/image/upload/hero-1.webp",
      mobileUrl: "https://res.cloudinary.com/demo/image/upload/hero-1-mobile.webp",
      alt: "Baby wearing traditional ethnic outfit",
      sortOrder: 1,
      isActive: true,
    },
    {
      url: "https://res.cloudinary.com/demo/image/upload/hero-2.webp",
      mobileUrl: null,
      alt: "Festive collection for little ones",
      sortOrder: 2,
      isActive: true,
    },
  ];

  for (const h of heroImages) {
    await prisma.heroImage.create({ data: h });
  }

  const promoMessages = [
    "20% off on all orders",
    "Free shipping on all orders",
    "New festive collection is now live",
    "Shop now and get exclusive offers",
  ];

  for (let i = 0; i < promoMessages.length; i++) {
    await prisma.promotionalMessage.create({
      data: {
        message: promoMessages[i],
        sortOrder: i + 1,
        isActive: true,
      },
    });
  }

  const socialLinks: Array<{
    platform: SocialPlatform;
    url: string;
    icon: string;
    sortOrder: number;
  }> = [
    {
      platform: SocialPlatform.instagram,
      url: "https://instagram.com/babypleats",
      icon: "instagram",
      sortOrder: 1,
    },
    {
      platform: SocialPlatform.facebook,
      url: "https://facebook.com/babypleats",
      icon: "facebook",
      sortOrder: 2,
    },
    {
      platform: SocialPlatform.youtube,
      url: "https://youtube.com/@babypleats",
      icon: "youtube",
      sortOrder: 3,
    },
    {
      platform: SocialPlatform.whatsapp,
      url: "https://wa.me/910000000000",
      icon: "whatsapp",
      sortOrder: 4,
    },
  ];

  for (const s of socialLinks) {
    await prisma.socialLink.create({
      data: { ...s, isActive: true },
    });
  }

  console.log(
    `Seeded ${seed.categories.length} categories, ${seed.products.length} products, ` +
      `${heroImages.length} hero images, ${promoMessages.length} promo messages, ` +
      `${socialLinks.length} social links`
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
