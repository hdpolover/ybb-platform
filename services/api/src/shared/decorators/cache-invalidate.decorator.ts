import { SetMetadata } from '@nestjs/common';

export const CACHE_INVALIDATE_KEY = 'cache:invalidate';

/**
 * Decorator to mark methods that should invalidate cache
 * Usage: @CacheInvalidate(['program:*', 'programs:list:*'])
 */
export const CacheInvalidate = (patterns: string[]) =>
  SetMetadata(CACHE_INVALIDATE_KEY, patterns);
