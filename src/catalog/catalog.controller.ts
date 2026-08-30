import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { CatalogService } from "./catalog.service";
import type {
  CategoryWriteBody,
  ProductWriteBody,
} from "./catalog.service";

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

  @Post("categories")
  @UseGuards(ApiKeyGuard)
  @HttpCode(201)
  async createCategory(@Body() body: CategoryWriteBody) {
    const data = await this.catalog.createCategory(body);
    return { data };
  }

  @Patch("categories/:id")
  @UseGuards(ApiKeyGuard)
  async patchCategory(
    @Param("id") id: string,
    @Body() body: Partial<CategoryWriteBody>
  ) {
    const data = await this.catalog.updateCategory(id, body);
    return { data };
  }

  @Put("categories/:id")
  @UseGuards(ApiKeyGuard)
  async putCategory(
    @Param("id") id: string,
    @Body() body: Partial<CategoryWriteBody>
  ) {
    const data = await this.catalog.updateCategory(id, body);
    return { data };
  }

  @Delete("categories/:id")
  @UseGuards(ApiKeyGuard)
  @HttpCode(204)
  async deleteCategory(@Param("id") id: string) {
    await this.catalog.deleteCategory(id);
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

  @Post("products")
  @UseGuards(ApiKeyGuard)
  @HttpCode(201)
  async createProduct(@Body() body: ProductWriteBody) {
    const data = await this.catalog.createProduct(body);
    return { data };
  }

  @Get("products/:slug")
  async getProduct(@Param("slug") slug: string) {
    const data = await this.catalog.getProductBySlug(slug);
    return { data };
  }

  @Patch("products/:id")
  @UseGuards(ApiKeyGuard)
  async patchProduct(
    @Param("id") id: string,
    @Body() body: Partial<ProductWriteBody>
  ) {
    const data = await this.catalog.updateProduct(id, body);
    return { data };
  }

  @Put("products/:id")
  @UseGuards(ApiKeyGuard)
  async putProduct(
    @Param("id") id: string,
    @Body() body: Partial<ProductWriteBody>
  ) {
    const data = await this.catalog.updateProduct(id, body);
    return { data };
  }

  @Delete("products/:id")
  @UseGuards(ApiKeyGuard)
  @HttpCode(204)
  async deleteProduct(@Param("id") id: string) {
    await this.catalog.deleteProduct(id);
  }
}
