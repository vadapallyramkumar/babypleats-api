import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
      const details =
        typeof body === 'object' && body !== null && 'details' in body
          ? body.details
          : Array.isArray(message)
            ? message
            : null;

      const codeMap: Record<number, string> = {
        400: 'VALIDATION_ERROR',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        429: 'RATE_LIMITED',
      };

      return res.status(status).json({
        error: {
          code: codeMap[status] ?? 'INTERNAL_ERROR',
          message: Array.isArray(message) ? message.join('; ') : message,
          details,
        },
      });
    }

    console.error(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server fault',
        details: null,
      },
    });
  }
}
