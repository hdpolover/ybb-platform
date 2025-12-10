import { SetMetadata } from '@nestjs/common';

/**
 * Decorator metadata key for cache invalidation patterns
 */
export const CACHE_INVALIDATE_KEY = 'cache:invalidate:patterns';

/**
 * CacheInvalidate Decorator
 * 
 * Marks a method to automatically invalidate cache entries after execution.
 * Supports wildcard patterns for invalidating multiple related cache entries.
 * 
 * @example
 * // Invalidate specific user cache and all user lists
 * @CacheInvalidate(['user:${id}', 'user:list:*'])
 * async updateUser(id: string, data: UpdateUserDto) { ... }
 * 
 * @example
 * // Invalidate all program-related caches
 * @CacheInvalidate(['program:*'])
 * async createProgram(data: CreateProgramDto) { ... }
 */
export const CacheInvalidate = (patterns: string[]) =>
  SetMetadata(CACHE_INVALIDATE_KEY, patterns);

/**
 * Helper function to resolve dynamic cache patterns
 * Replaces ${paramName} with actual values from request params
 */
export function resolveCachePatterns(
  patterns: string[],
  params: Record<string, any>,
): string[] {
  return patterns.map((pattern) => {
    let resolved = pattern;
    for (const [key, value] of Object.entries(params)) {
      resolved = resolved.replace(`\${${key}}`, String(value));
    }
    return resolved;
  });
}

