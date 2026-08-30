import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      data: {
        name: "Baby Pleats API",
        version: "1.1.0",
        endpoints: {
          health: "GET /health",
          categories: "GET /v1/categories",
          createCategory: "POST /v1/categories",
          updateCategory: "PUT|PATCH /v1/categories/:id",
          deleteCategory: "DELETE /v1/categories/:id",
          products: "GET /v1/products",
          productBySlug: "GET /v1/products/:slug",
          createProduct: "POST /v1/products",
          updateProduct: "PUT|PATCH /v1/products/:id",
          deleteProduct: "DELETE /v1/products/:id",
        },
      },
    };
  }

  @Get("health")
  health() {
    return { data: { status: "ok" } };
  }
}
