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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/catalog-write.dto';

function parseBool(v?: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  async listCategories(
    @Query('includeInactive') includeInactive?: string,
  ) {
    const data = await this.catalog.listCategories({
      includeInactive: parseBool(includeInactive) === true,
    });
    return { data };
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createCategory(@Body() body: CreateCategoryDto) {
    const data = await this.catalog.createCategory(body);
    return { data };
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard)
  async patchCategory(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const data = await this.catalog.updateCategory(id, body);
    return { data };
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard)
  async putCategory(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const data = await this.catalog.updateCategory(id, body);
    return { data };
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteCategory(@Param('id') id: string) {
    await this.catalog.deleteCategory(id);
  }

  @Get('products')
  async listProducts(
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('isNew') isNew?: string,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.catalog.listProducts(
      {
        category,
        featured: parseBool(featured),
        isNew: parseBool(isNew),
        tag,
        q,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      { includeInactive: parseBool(includeInactive) === true },
    );
  }

  @Post('products')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createProduct(@Body() body: CreateProductDto) {
    const data = await this.catalog.createProduct(body);
    return { data };
  }

  @Get('products/:slug')
  async getProduct(
    @Param('slug') slug: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const data = await this.catalog.getProductBySlug(
      slug,
      parseBool(includeInactive) === true,
    );
    return { data };
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard)
  async patchProduct(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    const data = await this.catalog.updateProduct(id, body);
    return { data };
  }

  @Put('products/:id')
  @UseGuards(JwtAuthGuard)
  async putProduct(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    const data = await this.catalog.updateProduct(id, body);
    return { data };
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteProduct(@Param('id') id: string) {
    await this.catalog.deleteProduct(id);
  }
}
