import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

function parseBool(v?: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  async listCategories() {
    const data = await this.catalog.listCategories();
    return { data };
  }

  @Get("products")
  async listProducts(
    @Query("category") category?: string,
    @Query("featured") featured?: string,
    @Query("isNew") isNew?: string,
    @Query("tag") tag?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.catalog.listProducts({
      category,
      featured: parseBool(featured),
      isNew: parseBool(isNew),
      tag,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("products/:slug")
  async getProduct(@Param("slug") slug: string) {
    const data = await this.catalog.getProductBySlug(slug);
    return { data };
  }
}
