import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.API_WRITE_KEY?.trim();
    if (!expected) {
      throw new UnauthorizedException(
        "Write API is disabled until API_WRITE_KEY is set"
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    const bearer =
      header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    const apiKeyHeader = req.headers["x-api-key"];
    const fromHeader = Array.isArray(apiKeyHeader)
      ? apiKeyHeader[0]
      : apiKeyHeader;
    const provided = (bearer || fromHeader || "").trim();

    if (!provided || provided !== expected) {
      throw new UnauthorizedException("Missing or invalid API key");
    }
    return true;
  }
}
