import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim() || undefined;
  }
  return undefined;
}

export function extractApiKey(req: Request): string | undefined {
  const bearer = extractBearerToken(req);
  const apiKeyHeader = req.headers['x-api-key'];
  const fromHeader = Array.isArray(apiKeyHeader)
    ? apiKeyHeader[0]
    : apiKeyHeader;
  return (fromHeader || bearer || '').trim() || undefined;
}

export function isValidApiKey(provided: string | undefined): boolean {
  const expected = process.env.API_WRITE_KEY?.trim();
  if (!expected || !provided) return false;
  return provided === expected;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.API_WRITE_KEY?.trim();
    if (!expected) {
      throw new UnauthorizedException(
        'Write API is disabled until API_WRITE_KEY is set',
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = extractApiKey(req);

    if (!isValidApiKey(provided)) {
      throw new UnauthorizedException('Missing or invalid API key');
    }
    return true;
  }
}
