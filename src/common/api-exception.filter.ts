import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Response } from 'express';

function isMulterLimitError(exception: unknown): boolean {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    (exception as { code?: string }).code === 'LIMIT_FILE_SIZE'
  );
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (isMulterLimitError(exception)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Uploaded file is too large (max 50MB)',
          details: null,
        },
      });
    }

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

      if (status >= 500) {
        this.logger.error(exception);
        this.capture(exception);
      }

      return res.status(status).json({
        success: false,
        error: {
          code: codeMap[status] ?? 'INTERNAL_ERROR',
          message: Array.isArray(message) ? message.join('; ') : message,
          details,
        },
      });
    }

    this.logger.error(exception);
    this.capture(exception);

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server fault',
        details: null,
      },
    });
  }

  private capture(exception: unknown) {
    if (!process.env.SENTRY_DSN?.trim()) return;
    Sentry.captureException(exception);
  }
}
