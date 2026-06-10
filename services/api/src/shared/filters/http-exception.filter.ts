import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  DomainException,
  EntityNotFoundException,
  InvalidOperationException,
  ValidationException,
  UnauthorizedException as DomainUnauthorizedException,
  DuplicateEntityException,
} from '@core/exceptions/domain.exception';

const isProd = process.env.NODE_ENV === 'production';

function domainToHttp(ex: DomainException): { status: number; message: string } {
  if (ex instanceof EntityNotFoundException) return { status: 404, message: ex.message };
  if (ex instanceof DuplicateEntityException) return { status: 409, message: ex.message };
  if (ex instanceof ValidationException) return { status: 422, message: ex.message };
  if (ex instanceof InvalidOperationException) return { status: 400, message: ex.message };
  if (ex instanceof DomainUnauthorizedException) return { status: 401, message: ex.message };
  return { status: 400, message: ex.message };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status: number;
    let userMessage: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      // NestJS validation errors include a `message` array — keep those
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const raw = (body as { message: unknown }).message;
        userMessage = Array.isArray(raw) ? raw.join('; ') : String(raw);
      } else {
        userMessage = typeof body === 'string' ? body : exception.message;
      }
      // Sanitize 5xx messages in production
      if (isProd && status >= 500) {
        this.logger.error(
          `[${req.method}] ${req.url} → ${status} | ${userMessage}`,
          exception instanceof Error ? exception.stack : undefined,
        );
        userMessage = 'Something went wrong. Please try again later.';
      }
    } else if (exception instanceof DomainException) {
      ({ status, message: userMessage } = domainToHttp(exception));
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const raw = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        `[${req.method}] ${req.url} → 500 | ${raw}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      userMessage = isProd
        ? 'Something went wrong. Please try again later.'
        : raw;
    }

    res.status(status).json({
      statusCode: status,
      message: userMessage,
      path: req.url,
    });
  }
}
