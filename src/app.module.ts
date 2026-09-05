import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { HomeModule } from './home/home.module';
import { PrismaModule } from './prisma/prisma.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 5,
      },
    ]),
    PrismaModule,
    AuthModule,
    CatalogModule,
    HomeModule,
    MediaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
