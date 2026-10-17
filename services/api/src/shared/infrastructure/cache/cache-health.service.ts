// src/shared/infrastructure/cache/cache-health.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

const PING_TIMEOUT_MS = 1_000;

/**
 * - `ok`: a write through the cache client reads back.
 * - `redis-unreachable`: the cache fails AND a fresh connection cannot reach
 *   Redis either. A real outage; restarting the API would not fix it.
 * - `client-wedged`: the cache fails but Redis answers a fresh connection. The
 *   in-process client is stuck, and a restart is exactly the fix.
 */
export type CacheHealth = 'ok' | 'redis-unreachable' | 'client-wedged';

/**
 * Distinguishes a stuck cache client from a Redis outage, so /v1/health can
 * fail on the first and not the second.
 *
 * Redis is a soft dependency (see TokenBlacklistService.isBlacklisted): during
 * an outage the API keeps serving on cache misses, so failing health then would
 * have Swarm kill healthy replicas and turn a cache blip into a full API outage.
 * A wedged client is different: it never recovers on its own (2026-10-16, ~11h
 * until a manual restart), and while wedged token revocation silently fails
 * open. That case alone is worth a restart.
 */
@Injectable()
export class CacheHealthService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<CacheHealth> {
    if (await this.cacheService.probe()) return 'ok';
    return (await this.isRedisReachable()) ? 'client-wedged' : 'redis-unreachable';
  }

  // A throwaway connection, opened only when the probe has already failed, so
  // it cannot inherit whatever state wedged the long-lived client.
  private async isRedisReachable(): Promise<boolean> {
    const redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.getOrThrow<string>('REDIS_PASSWORD'),
      lazyConnect: true,
      connectTimeout: PING_TIMEOUT_MS,
      commandTimeout: PING_TIMEOUT_MS,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    // Without a listener ioredis prints every failed attempt's stack to stderr.
    redis.on('error', () => undefined);
    try {
      await redis.connect();
      return (await redis.ping()) === 'PONG';
    } catch {
      return false;
    } finally {
      redis.disconnect();
    }
  }
}
