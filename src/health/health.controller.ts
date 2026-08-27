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
          products: "GET /v1/products",
          productBySlug: "GET /v1/products/:slug",
        },
      },
    };
  }

  @Get("health")
  health() {
    return { data: { status: "ok" } };
  }
}
