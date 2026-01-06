import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const val = data as any;

        // Skip if it's already a formatted response
        if (val && val.statusCode && val.data) {
            return val;
        }
        
        // 1. Handle { data: [], ...rest } pattern (e.g. Programs pagination)
        if (val && typeof val === 'object' && !Array.isArray(val) && Array.isArray(val.data)) {
            const { data: items, ...metaData } = val;
            return {
                statusCode: response.statusCode,
                message: 'Success',
                data: items,
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
                data: items,
                meta: finalMeta,
             };
        }

        // 3. Fallback for simple objects or arrays
        return {
          statusCode: response.statusCode,
          message: 'Success',
          data: val,
        };
      }),
    );
  }
}
