import { Injectable, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CacheMetricsService } from './cache-metrics.service';

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Optional() private readonly metricsService?: CacheMetricsService,
  ) { }

  /**
   * Invalidate cache by pattern (supports wildcards)
   * Example: invalidateByPattern('program:*') clears all program-related cache
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    const startTime = Date.now();
    try {
      // Get the underlying Redis client from the store
      const store = (this.cacheManager as unknown as { store?: { client?: { keys: (p: string) => Promise<string[]>; del: (...k: string[]) => Promise<void> } } }).store;
      if (store?.client) {
        const keys = await store.client.keys(pattern);
        if (keys.length > 0) {
          await store.client.del(...keys);
        }
      }
      this.metricsService?.recordLatency('invalidate_pattern', Date.now() - startTime);
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
    const startTime = Date.now();
    await this.cacheManager.del(key);
    this.metricsService?.recordDelete();
    this.metricsService?.recordLatency('delete', Date.now() - startTime);
  }

  /**
   * Invalidate multiple keys
   */
  async invalidateKeys(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
    keys.forEach(() => this.metricsService?.recordDelete());
  }

  /**
   * Get cached value (with metrics tracking)
   */
  async get<T>(key: string): Promise<T | undefined> {
    const startTime = Date.now();
    const result = await this.cacheManager.get<T>(key);

    if (result !== undefined && result !== null) {
      this.metricsService?.recordHit();
    } else {
      this.metricsService?.recordMiss();
    }
    this.metricsService?.recordLatency('get', Date.now() - startTime);

    return result;
  }

  /**
   * Set cached value (with metrics tracking)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    await this.cacheManager.set(key, value, ttl);
    this.metricsService?.recordSet();
    this.metricsService?.recordLatency('set', Date.now() - startTime);
  }

  /**
   * Clear entire cache
   */
  async clearAll(): Promise<void> {
    const startTime = Date.now();
    // Try to use Redis FLUSHDB via store
    const store = (this.cacheManager as unknown as { store?: { client?: { flushdb?: () => Promise<void> } } }).store;
    if (store?.client) {
      await store.client.flushdb?.();
    } else {
      // Fallback for cache-manager v7
      const stores = (this.cacheManager as unknown as { stores?: Array<{ clear?: () => Promise<void> }> }).stores;
      if (stores && stores.length > 0) {
        await Promise.all(stores.map((s) => s.clear?.()));
      }
    }
    this.metricsService?.recordLatency('clear', Date.now() - startTime);
  }
}

