import './instrument';

import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { isOriginAllowed, parseCorsOrigins } from './common/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS_ORIGIN: comma-separated allowlist (e.g. production + temporary Render URLs).
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        // Reflect the request Origin (never '*') when allowed.
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
    // Auth is Bearer JWT via Authorization; cookies are not used for auth.
    // Keep credentials off so we never pair credentials with a wildcard origin.
    credentials: false,
  });

  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Baby Pleats API listening on http://0.0.0.0:${port}/v1`);
}

bootstrap();
