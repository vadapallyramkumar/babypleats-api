import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ApiVariant,
  ColorGallery,
  mapCategory,
  mapProduct,
  serializeCare,
  serializeGalleries,
  serializeImages,
  serializeTags,
  serializeVariants,
} from "../common/mappers";

export type CategoryWriteBody = {
  id?: string;
  slug: string;
  name: string;
  image: string;
  description: string;
  sortOrder?: number;
  isActive?: boolean;
  filter?: string | null;
};

export type ProductWriteBody = {
  id?: string;
  slug: string;
  name: string;
  categoryId: string;
  subcategory?: string | null;
  description: string;
  fabric?: string | null;
  care?: string[];
  images: string[];
  colorGalleries?: ColorGallery[];
  variants: ApiVariant[];
  isNew?: boolean;
  featured?: boolean;
  isActive?: boolean;
  rating?: number | null;
  reviewsCount?: number | null;
  tags?: string[];
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(activeOnly = true) {
    const rows = await this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapCategory);
  }

  async getCategoryBySlug(slug: string) {
    return this.prisma.category.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
    });
  }

  async listProducts(
    query: {
      category?: string;
      featured?: boolean;
      isNew?: boolean;
      tag?: string;
      q?: string;
      page?: number;
      limit?: number;
      isActive?: boolean;
    },
    opts: { includeInactive?: boolean } = {}
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));
    const where: Prisma.ProductWhereInput = {};

    if (!opts.includeInactive) {
      where.isActive = true;
    } else if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.featured !== undefined) where.featured = query.featured;
    if (query.isNew !== undefined) where.isNew = query.isNew;

    if (query.category) {
      const cat = await this.getCategoryBySlug(query.category);
      if (cat?.filter === "bestseller") {
        where.featured = true;
      } else if (cat?.filter === "readyToDispatch") {
        where.tags = { contains: "ready-to-dispatch" };
      } else if (cat?.filter === "budgetFriendly") {
        where.tags = { contains: "budget-friendly" };
      } else {
        where.categoryId = cat?.id ?? query.category;
      }
    }

    if (query.tag) {
      where.tags = { contains: query.tag };
    }

    if (query.q) {
      const q = query.q;
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { id: { contains: q } },
        { slug: { contains: q } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((r) => mapProduct(r, Boolean(opts.includeInactive))),
      meta: { page, limit, total },
    };
  }

  async getProductBySlug(slug: string) {
    const row = await this.prisma.product.findUnique({ where: { slug } });
    if (!row || !row.isActive) {
      throw new NotFoundException("Product not found");
    }
    return mapProduct(row);
  }

  async getProductById(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Product not found");
    return mapProduct(row, true);
  }

  async createCategory(body: CategoryWriteBody) {
    this.assertCategoryFilter(body.filter);
    if (!body.slug?.trim() || !body.name?.trim() || !body.image?.trim()) {
      throw new BadRequestException("slug, name, and image are required");
    }
    const id = body.id ?? body.slug;
    try {
      const row = await this.prisma.category.create({
        data: {
          id,
          slug: body.slug,
          name: body.name,
          image: body.image,
          description: body.description ?? "",
          sortOrder: body.sortOrder ?? 0,
          isActive: body.isActive ?? true,
          filter: body.filter ?? null,
        },
      });
      return mapCategory(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Category id or slug already exists");
      }
      throw e;
    }
  }

  async updateCategory(id: string, body: Partial<CategoryWriteBody>) {
    this.assertCategoryFilter(body.filter);
    this.assertNonEmptyString(body.slug, "slug");
    this.assertNonEmptyString(body.name, "name");
    this.assertNonEmptyString(body.image, "image");

    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");

    try {
      const row = await this.prisma.category.update({
        where: { id },
        data: {
          ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}),
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.image !== undefined ? { image: body.image.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description }
            : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.filter !== undefined ? { filter: body.filter } : {}),
        },
      });
      return mapCategory(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Category slug already exists");
      }
      throw e;
    }
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");

    const productCount = await this.prisma.product.count({
      where: { categoryId: id, isActive: true },
    });
    if (productCount > 0) {
      throw new ConflictException(
        "Category has active products; deactivate or reassign them first"
      );
    }

    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createProduct(body: ProductWriteBody) {
    this.assertProductWrite(body);
    const id = body.id ?? body.slug;
    const category = await this.prisma.category.findUnique({
      where: { id: body.categoryId },
    });
    if (!category) {
      throw new BadRequestException(`Unknown categoryId ${body.categoryId}`);
    }

    try {
      const row = await this.prisma.product.create({
        data: this.toProductData(body, id),
      });
      return mapProduct(row, true);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Product id or slug already exists");
      }
      throw e;
    }
  }

  async updateProduct(id: string, body: Partial<ProductWriteBody>) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Product not found");

    if (body.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: body.categoryId },
      });
      if (!category) {
        throw new BadRequestException(`Unknown categoryId ${body.categoryId}`);
      }
    }

    const merged: ProductWriteBody = {
      slug: body.slug ?? existing.slug,
      name: body.name ?? existing.name,
      categoryId: body.categoryId ?? existing.categoryId,
      subcategory:
        body.subcategory !== undefined
          ? body.subcategory
          : existing.subcategory,
      description: body.description ?? existing.description,
      fabric: body.fabric !== undefined ? body.fabric : existing.fabric,
      care:
        body.care ??
        (JSON.parse(existing.care || "[]") as string[]),
      images:
        body.images ??
        (JSON.parse(existing.images || "[]") as string[]),
      colorGalleries:
        body.colorGalleries ??
        (JSON.parse(existing.colorGalleries || "[]") as ColorGallery[]),
      variants:
        body.variants ??
        (JSON.parse(existing.variants || "[]") as ApiVariant[]),
      isNew: body.isNew ?? existing.isNew,
      featured: body.featured ?? existing.featured,
      isActive: body.isActive ?? existing.isActive,
      rating: body.rating !== undefined ? body.rating : existing.rating,
      reviewsCount:
        body.reviewsCount !== undefined
          ? body.reviewsCount
          : existing.reviewsCount,
      tags: body.tags ?? (JSON.parse(existing.tags || "[]") as string[]),
    };

    this.assertProductWrite(merged);

    try {
      const row = await this.prisma.product.update({
        where: { id },
        data: this.toProductData(merged, id),
      });
      return mapProduct(row, true);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Product slug already exists");
      }
      throw e;
    }
  }

  async deleteProduct(id: string) {
    try {
      await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        throw new NotFoundException("Product not found");
      }
      throw e;
    }
  }

  private toProductData(body: ProductWriteBody, id: string) {
    return {
      id,
      slug: body.slug,
      name: body.name,
      categoryId: body.categoryId,
      subcategory: body.subcategory ?? null,
      description: body.description,
      fabric: body.fabric ?? null,
      care: serializeCare(body.care ?? []),
      images: serializeImages(body.images),
      colorGalleries: serializeGalleries(body.colorGalleries ?? []),
      variants: serializeVariants(body.variants),
      isNew: body.isNew ?? false,
      featured: body.featured ?? false,
      isActive: body.isActive ?? true,
      rating: body.rating ?? null,
      reviewsCount: body.reviewsCount ?? null,
      tags: serializeTags(body.tags ?? []),
    };
  }

  private assertNonEmptyString(value: string | undefined, field: string) {
    if (value === undefined) return;
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }
  }

  private assertCategoryFilter(filter?: string | null) {
    if (filter == null || filter === "") return;
    const allowed = ["budgetFriendly", "readyToDispatch", "bestseller"];
    if (!allowed.includes(filter)) {
      throw new BadRequestException(
        `filter must be one of: ${allowed.join(", ")}`
      );
    }
  }

  private assertProductWrite(body: ProductWriteBody) {
    if (!body.slug?.trim() || !body.name?.trim() || !body.categoryId?.trim()) {
      throw new BadRequestException("slug, name, and categoryId are required");
    }
    if (!body.images?.length) {
      throw new BadRequestException("images must include at least one URL");
    }
    if (!body.variants?.length) {
      throw new BadRequestException("variants must include at least one item");
    }
  }
}
