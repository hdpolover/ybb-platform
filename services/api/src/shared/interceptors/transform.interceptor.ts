import { Injectable, NestInterceptor, ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeDates<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDates(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]),
    ) as T;
  }

  return value;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data): Response<T> => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const val = normalizeDates(data as T & Record<string, unknown>);

        // Pass file streams through untouched — wrapping them in JSON corrupts
        // binary downloads (PDF receipts, exports, etc.). instanceof can fail across
        // module realms; duck-type on getStream() instead.
        if (
            data instanceof StreamableFile
            || (data && typeof (data as { getStream?: unknown }).getStream === 'function')
        ) {
            return data as unknown as Response<T>;
        }

        // Skip if it's already a formatted response
        if (val && val.statusCode && val.data) {
            return val as unknown as Response<T>;
        }
        
        // 1. Handle { data: [], ...rest } pattern (e.g. Programs pagination)
        if (val && typeof val === 'object' && !Array.isArray(val) && Array.isArray(val.data)) {
            const { data: items, ...metaData } = val;
            return {
                statusCode: response.statusCode,
                message: 'Success',
                data: items as unknown as T,
                meta: metaData,
            };
        }
        
        // 2. Handle { items: [], meta?: ... } pattern
        if (val && typeof val === 'object' && !Array.isArray(val) && Array.isArray(val.items)) {
             const { items, meta, ...rest } = val;
             const finalMeta = meta || (Object.keys(rest).length ? rest : undefined);
             return {
                statusCode: response.statusCode,
                message: 'Success',
                data: items as unknown as T,
                meta: finalMeta as Record<string, unknown> | undefined,
             };
        }

        // 3. Fallback for simple objects or arrays
        return {
          statusCode: response.statusCode,
          message: 'Success',
          data: val as unknown as T,
        };
      }),
    );
  }
}
