import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import type { AdminUserPublic, JwtPayload } from './auth.types';
import { extractBearerToken } from './api-key.guard';

export type AuthedRequest = Request & { user?: AdminUserPublic };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    const user = await this.auth.getUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    req.user = user;
    return true;
  }
}
