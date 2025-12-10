import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../infrastructure/cache/cache.service';
import { RedisPubSubService } from '../infrastructure/redis/redis-pubsub.service';
import {
  CACHE_INVALIDATE_KEY,
  resolveCachePatterns,
} from '../decorators/cache-invalidate.decorator';

/**
 * Interceptor that automatically invalidates cache based on @CacheInvalidate decorator
 * 
 * Supports:
 * - Static patterns: @CacheInvalidate(['program:*'])
 * - Dynamic patterns: @CacheInvalidate(['user:${id}', 'user:list:*'])
 * - Multi-instance sync via Redis Pub/Sub (optional)
 */
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInvalidationInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    @Optional() private readonly pubSubService?: RedisPubSubService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const patterns = this.reflector.get<string[]>(
      CACHE_INVALIDATE_KEY,
      context.getHandler(),
    );

    if (!patterns || patterns.length === 0) {
      return next.handle();
    }

    // Get request params for dynamic pattern resolution
    const request = context.switchToHttp().getRequest();
    const params = {
      ...request.params,
      ...request.body,
      ...request.query,
    };

    return next.handle().pipe(
      tap(async () => {
        try {
          // Resolve dynamic patterns (e.g., 'user:${id}' -> 'user:123')
          const resolvedPatterns = resolveCachePatterns(patterns, params);

          // Use Pub/Sub if available (multi-instance), otherwise local only
          if (this.pubSubService) {
            await this.pubSubService.invalidateAndPublish(resolvedPatterns);
          } else {
            await this.cacheService.invalidateByPatterns(resolvedPatterns);
          }

          this.logger.debug(`Cache invalidated: ${resolvedPatterns.join(', ')}`);
        } catch (error) {
          this.logger.error('Failed to invalidate cache:', error);
          // Don't throw - cache invalidation failures shouldn't break the app
        }
      }),
    );
  }
}

