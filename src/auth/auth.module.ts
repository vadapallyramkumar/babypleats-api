import { Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET must be set');
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (): JwtModuleOptions => ({
        secret: requireJwtSecret(),
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN?.trim() || '8h') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
