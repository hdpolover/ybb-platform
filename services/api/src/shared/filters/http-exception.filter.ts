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
    // Optional machine-readable error code forwarded from the exception
    // response body. Accepts either `errorCode` (e.g.
    // BadRequestException({ message, errorCode })) or `code` (e.g. the
    // `programs` module's BadRequestException({ code, message }) /
    // ConflictException({ code, message }) shape) so both spellings reach
    // the client — `errorCode` wins when both are present. Always emitted
    // as `errorCode` to keep the public response contract unchanged. Only
    // included in the JSON response when present, to stay backward compatible.
    let errorCode: string | undefined;
    // Optional field-level error detail forwarded from the exception response
    // body (e.g. BadRequestException({ message, errors: [{ path, message }] }),
    // used by UpsertApplicationReviewHandler and UpsertScoringRubricHandler so
    // the admin UI can key a form error onto the exact field via errors[].path).
    // Without this, `errors` was silently dropped: only `message`/`errorCode`
    // were ever read off the exception body below. Only included when present,
    // to stay backward compatible with every other thrown exception shape.
    let errors: unknown;

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
      if (
        typeof body === 'object' &&
        body !== null &&
        'errorCode' in body &&
        typeof (body as { errorCode: unknown }).errorCode === 'string'
      ) {
        errorCode = (body as { errorCode: string }).errorCode;
      } else if (
        typeof body === 'object' &&
        body !== null &&
        'code' in body &&
        typeof (body as { code: unknown }).code === 'string'
      ) {
        errorCode = (body as { code: string }).code;
      }
      if (typeof body === 'object' && body !== null && 'errors' in body && Array.isArray((body as { errors: unknown }).errors)) {
        errors = (body as { errors: unknown[] }).errors;
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

    // 4xx responses were previously silent server-side, making client-error
    // spikes (validation failures, bad requests, etc.) undiagnosable in prod.
    // Log a single warn line — no request body/headers/tokens — so these are
    // at least visible without treating them as incidents like 5xx errors.
    if (status >= 400 && status < 500) {
      const userId = (req.user as { userId?: string } | undefined)?.userId;
      this.logger.warn(
        `[${req.method}] ${req.url} → ${status} | ${userMessage}${
          userId ? ` | user=${userId}` : ''
        }`,
      );
    }

    res.status(status).json({
      statusCode: status,
      message: userMessage,
      path: req.url,
      ...(errorCode ? { errorCode } : {}),
      ...(errors ? { errors } : {}),
    });
  }
}
