import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.types';
import {
  extractApiKey,
  extractBearerToken,
  isValidApiKey,
} from './api-key.guard';
import type { AuthedRequest } from './jwt-auth.guard';

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    // Prefer JWT when Bearer token is present and verifies; fall back to API key.
    const bearer = extractBearerToken(req);
    if (bearer) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(bearer);
        const user = await this.auth.getUserById(payload.sub);
        if (user) {
          req.user = user;
          return true;
        }
      } catch {
        // Not a valid JWT — may still be the shared write key sent as Bearer.
        if (isValidApiKey(bearer)) {
          return true;
        }
        throw new UnauthorizedException('Missing or invalid credentials');
      }
    }

    const apiKey = extractApiKey(req);
    if (isValidApiKey(apiKey)) {
      return true;
    }

    throw new UnauthorizedException('Missing or invalid credentials');
  }
}
