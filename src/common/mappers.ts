export type ApiVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  price: { selling: number; original?: number; currency: "INR" };
  stock: number;
  isActive: boolean;
  image?: string;
};

export type ColorGallery = { color: string; images: string[] };

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  subcategory: string | null;
  description: string;
  fabric: string | null;
  care: string;
  images: string;
  colorGalleries: string;
  variants: string;
  isNew: boolean;
  featured: boolean;
  isActive: boolean;
  rating: number | null;
  reviewsCount: number | null;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function serializeVariants(variants: ApiVariant[]) {
  return JSON.stringify(variants);
}

export function serializeCare(care: string[]) {
  return JSON.stringify(care);
}

export function serializeImages(images: string[]) {
  return JSON.stringify(images);
}

export function serializeGalleries(g: ColorGallery[]) {
  return JSON.stringify(g);
}

export function serializeTags(tags: string[]) {
  return JSON.stringify(tags);
}

export function mapCategory(c: {
  id: string;
  slug: string;
  name: string;
  image: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  filter: string | null;
}) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    image: c.image,
    description: c.description,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    ...(c.filter ? { filter: c.filter } : {}),
  };
}

export function mapProduct(row: ProductRow, includeInactiveVariants = false) {
  const allVariants = parseJson<ApiVariant[]>(row.variants, []);
  const variants = includeInactiveVariants
    ? allVariants
    : allVariants.filter((v) => v.isActive);

  const active = variants.filter((v) => v.isActive);
  const priceSource = active.length ? active : variants;
  let min = priceSource[0];
  for (const v of priceSource) {
    if (v.price.selling < (min?.price.selling ?? Infinity)) min = v;
  }

  const priceFrom = min
    ? {
        selling: min.price.selling,
        ...(min.price.original != null ? { original: min.price.original } : {}),
        currency: "INR" as const,
      }
    : { selling: 0, currency: "INR" as const };

  const sizes = [...new Set(active.map((v) => v.size))];
  const colors = [...new Set(active.map((v) => v.color))];
  const stock = active.reduce((sum, v) => sum + v.stock, 0);

  const withDiscount = variants.map((v) => ({
    ...v,
    discountPercent: v.price.original
      ? Math.round((1 - v.price.selling / v.price.original) * 100)
      : 0,
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categoryId: row.categoryId,
    ...(row.subcategory ? { subcategory: row.subcategory } : {}),
    description: row.description,
    ...(row.fabric ? { fabric: row.fabric } : {}),
    care: parseJson<string[]>(row.care, []),
    images: parseJson<string[]>(row.images, []),
    colorGalleries: parseJson<ColorGallery[]>(row.colorGalleries, []),
    variants: withDiscount,
    priceFrom,
    sizes,
    colors,
    stock,
    isNew: row.isNew,
    featured: row.featured,
    isActive: row.isActive,
    ...(row.rating != null ? { rating: row.rating } : {}),
    ...(row.reviewsCount != null ? { reviewsCount: row.reviewsCount } : {}),
    tags: parseJson<string[]>(row.tags, []),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
