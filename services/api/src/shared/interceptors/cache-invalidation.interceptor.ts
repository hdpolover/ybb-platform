import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_INVALIDATE_KEY } from '../decorators/cache-invalidate.decorator';

/**
 * Interceptor that automatically invalidates cache based on @CacheInvalidate decorator
 * 
 * Usage:
 * @CacheInvalidate(['program:*', 'programs:list:*'])
 * async updateProgram() { ... }
 */
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const patterns = this.reflector.get<string[]>(
      CACHE_INVALIDATE_KEY,
      context.getHandler(),
    );

    if (!patterns || patterns.length === 0) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        // Invalidate cache after successful operation
        try {
          await this.cacheService.invalidateByPatterns(patterns);
          console.log(`Cache invalidated for patterns: ${patterns.join(', ')}`);
        } catch (error) {
          console.error('Failed to invalidate cache:', error);
          // Don't throw - cache invalidation failures shouldn't break the app
        }
      }),
    );
  }
}
