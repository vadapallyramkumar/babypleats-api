import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      data: {
        name: 'Baby Pleats API',
        version: '1.2.0',
        endpoints: {
          health: 'GET /health',
          categories: 'GET /v1/categories',
          createCategory: 'POST /v1/categories',
          updateCategory: 'PUT|PATCH /v1/categories/:id',
          deleteCategory: 'DELETE /v1/categories/:id',
          products: 'GET /v1/products',
          productBySlug: 'GET /v1/products/:slug',
          createProduct: 'POST /v1/products',
          updateProduct: 'PUT|PATCH /v1/products/:id',
          deleteProduct: 'DELETE /v1/products/:id',
          heroImages: 'GET|POST /v1/home/hero-images',
          heroImageById: 'GET|PATCH|DELETE /v1/home/hero-images/:id',
          promotionalMessages: 'GET|POST /v1/home/promotional-messages',
          promotionalMessageById:
            'GET|PATCH|DELETE /v1/home/promotional-messages/:id',
          socialLinks: 'GET|POST /v1/home/social-links',
          socialLinkById: 'GET|PATCH|DELETE /v1/home/social-links/:id',
        },
      },
    };
  }

  @Get('health')
  health() {
    return { data: { status: 'ok' } };
  }
}
