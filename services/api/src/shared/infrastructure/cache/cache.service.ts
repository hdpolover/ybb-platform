import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CacheMetricsService } from './cache-metrics.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

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
      const client = this.getRedisClient();
      if (!client) {
        console.warn(`[CacheService] No Redis client found — skipping invalidation for pattern: ${pattern}`);
        return;
      }
      const keys = await this.scanKeys(client, pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      this.metricsService?.recordLatency('invalidate_pattern', Date.now() - startTime);
    } catch (error) {
      console.error('Error invalidating cache by pattern:', error);
      // Don't throw - cache invalidation failures shouldn't break the app
    }
  }

   
  private getRedisClient(): any | null {
    // cache-manager v7 path: cacheManager.stores[0].store.client (Keyv → KeyvRedis → ioredis)
    const stores = (this.cacheManager as unknown as { stores?: unknown[] }).stores;
    if (Array.isArray(stores) && stores.length > 0) {
      const client = (stores[0] as { store?: { client?: unknown } })?.store?.client;
      if (client) return client;
    }
    // cache-manager v4 fallback: cacheManager.store.client
    const store = (this.cacheManager as unknown as { store?: { client?: unknown } }).store;
    if ((store as { client?: unknown })?.client) return (store as { client: unknown }).client;
    return null;
  }

   
  private async scanKeys(client: any, pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
      // node-redis v4 expects (cursor, { MATCH, COUNT }); ioredis expects (cursor, 'MATCH', p, 'COUNT', n).
      // The wrapped client here is node-redis (RedisClient from @redis/client) — using ioredis args
      // makes node-redis silently ignore the MATCH filter.
      const scanResult = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      const { cursor: newCursor, keys: batch } = this.normalizeScanResult(scanResult);
      cursor = newCursor;
      keys.push(...batch);
    } while (String(cursor) !== '0');
    return keys;
  }

   
  private normalizeScanResult(result: any): { cursor: string; keys: string[] } {
    if (Array.isArray(result)) {
      const [cursor, keys] = result;
      return {
        cursor: String(cursor),
        keys: Array.isArray(keys) ? keys.map((key) => String(key)) : [],
      };
    }

    if (result && typeof result === 'object') {
      const cursor = 'cursor' in result ? String(result.cursor) : '0';
      const keys = 'keys' in result && Array.isArray(result.keys)
        ? result.keys.map((key: unknown) => String(key))
        : [];

      return { cursor, keys };
    }

    throw new TypeError('Unsupported Redis SCAN response format');
  }

  /**
   * Invalidate multiple patterns at once
   */
  async invalidateByPatterns(patterns: string[]): Promise<void> {
    await Promise.all(patterns.map((pattern) => this.invalidateByPattern(pattern)));
  }

  /**
   * Invalidate all landing-page cache keys for a given brand.
   * Replaces the incorrect `landing:*:{brandId}` pattern which misses multi-segment keys
   * like `landing:program:{brandId}:{slug}` and `landing:faqs:{brandId}:*`.
   */
  async invalidateBrandLandingCaches(brandId: string): Promise<void> {
    await this.invalidateKeys([
      `landing:home:${brandId}`,
      `landing:about:${brandId}`,
      `landing:programs:${brandId}`,
      `landing:partners:${brandId}`,
      `landing:announcements:${brandId}`,
      `landing:settings:${brandId}`,
      CACHE_KEYS.LANDING_ACTIVITY(brandId),
      CACHE_KEYS.LANDING_OPEN_REGISTRATION_PROGRAMS(brandId),
      // Only clears a UUID-keyed resolveBrand() entry (some callers pass
      // brandId itself as the lookup key). The far more common host-keyed
      // entry can't be derived from a brandId alone, so a brand write also
      // busts every resolveBrand entry by pattern in
      // LandingCacheInvalidationService.bustBrandResolveCache().
      CACHE_KEYS.LANDING_BRAND_RESOLVE(brandId),
    ]);

    await this.invalidateByPatterns([
      `landing:program:${brandId}:*`,
      `landing:faqs:${brandId}:*`,
      `landing:announcements:${brandId}:*`,
      `landing:snapshot:${brandId}:*`,
    ]);
  }

  /**
   * Invalidate caches affected by an invoice status change.
   *
   * Busts:
   * - portal:payment-detail:${invoiceId} (when invoiceId provided)
   * - portal:payments:${userId}:* (every program's cached payments list for this user)
   * - portal:submission-detail:${userId}:* (the submit gate reads preview.payment.paid
   *   from here; without busting it, a paid registration fee stays invisible to the
   *   submit button for up to the cache TTL and the participant cannot submit)
   * - portal:dashboard:${userId}
   *
   * Pass invoiceId=undefined when no specific invoice is known (e.g. payment-failed events
   * may not have an invoiceId yet).
   */
  async invalidateInvoiceCache(invoiceId: string | undefined, userId: string): Promise<void> {
    try {
      const keys: string[] = [CACHE_KEYS.PORTAL_DASHBOARD(userId)];
      if (invoiceId) keys.push(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId));
      await Promise.all([
        this.invalidateKeys(keys),
        this.invalidateByPattern(`portal:payments:${userId}:*`),
        this.invalidateByPattern(`portal:submission-detail:${userId}:*`),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to invalidate invoice ${invoiceId ?? '(no invoice)'} cache for user ${userId}: ${msg}`);
    }
  }

  /**
   * Invalidate every portal read cache for a user, across all of their programs.
   *
   * The portal read handlers key on (userId, programId) - e.g.
   * `portal:submissions:<userId>:<programId>` - but most write paths either do
   * not carry a programId or only have one of several. Deleting the bare key
   * clears just the `:latest` variant and leaves the program-scoped entry to
   * serve stale data for the rest of its TTL, which is what made saves look
   * like they had not applied.
   *
   * So: always clear by pattern (covers every program variant including
   * `latest`), and also delete the non-program-scoped keys explicitly, since
   * patterns need a live Redis client for SCAN while plain deletes work on any
   * cache store.
   *
   * Patterns are built from CACHE_KEYS with '*' as the programId so they cannot
   * drift away from the key builders the read handlers use.
   */
  async invalidatePortalCache(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.invalidateKeys([
          CACHE_KEYS.PORTAL_DASHBOARD(userId),
          CACHE_KEYS.PORTAL_DOCUMENTS(userId),
          CACHE_KEYS.PORTAL_SUBMISSIONS(userId),
          CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId),
          CACHE_KEYS.PORTAL_PAYMENTS(userId),
        ]),
        this.invalidateByPatterns([
          CACHE_KEYS.PORTAL_SUBMISSIONS(userId, '*'),
          CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId, '*'),
          CACHE_KEYS.PORTAL_PAYMENTS(userId, '*'),
        ]),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to invalidate portal cache for user ${userId}: ${msg}`);
    }
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
    const client = this.getRedisClient();
    if (client) {
      // Use SCAN + DEL to clear all keys — avoids flushdb which may not be available
      // on the wrapped client exposed through Keyv/cache-manager. DEL takes an array;
      // spread only deletes the first key on node-redis v4.
      const keys = await this.scanKeys(client, '*');
      if (keys.length > 0) {
        await client.del(keys);
      }
    } else {
      const stores = (this.cacheManager as unknown as { stores?: Array<{ clear?: () => Promise<void> }> }).stores;
      if (stores && stores.length > 0) {
        await Promise.all(stores.map((s) => s.clear?.()));
      }
    }
    this.metricsService?.recordLatency('clear', Date.now() - startTime);
  }
}
