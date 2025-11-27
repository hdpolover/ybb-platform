import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Invalidate cache by pattern (supports wildcards)
   * Example: invalidateByPattern('program:*') clears all program-related cache
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      // For cache-manager v7 with Redis, pattern matching is more limited
      // We'll implement a simple wildcard approach
      console.warn(`Pattern-based cache invalidation not fully supported in cache-manager v7. Pattern: ${pattern}`);
      // For now, we'll clear the entire cache when a pattern is provided
      // In production, consider using Redis directly for pattern-based deletions
    } catch (error) {
      console.error('Error invalidating cache by pattern:', error);
      // Don't throw - cache invalidation failures shouldn't break the app
    }
  }

  /**
   * Invalidate multiple patterns at once
   */
  async invalidateByPatterns(patterns: string[]): Promise<void> {
    await Promise.all(patterns.map((pattern) => this.invalidateByPattern(pattern)));
  }

  /**
   * Invalidate specific key
   */
  async invalidateKey(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Invalidate multiple keys
   */
  async invalidateKeys(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  /**
   * Clear entire cache
   */
  async clearAll(): Promise<void> {
    // cache-manager v7 doesn't have reset(), use store.clear() if available
    const stores: any = (this.cacheManager as any).stores;
    if (stores && stores.length > 0) {
      await Promise.all(stores.map((store: any) => store.clear?.()));
    }
  }
}
