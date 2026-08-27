import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { mapCategory, mapProduct } from "../common/mappers";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapCategory);
  }

  async getCategoryBySlug(slug: string) {
    return this.prisma.category.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
    });
  }

  async listProducts(query: {
    category?: string;
    featured?: boolean;
    isNew?: boolean;
    tag?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));
    const where: Prisma.ProductWhereInput = { isActive: true };

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
      data: rows.map(mapProduct),
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
}
