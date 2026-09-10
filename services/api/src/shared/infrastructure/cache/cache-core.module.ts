import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { CacheService } from './cache.service';
import { CacheMetricsService } from './cache-metrics.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Minimal cache surface: the Redis-backed cache manager plus CacheService and
 * CacheMetricsService. This is what read/write cache access actually requires.
 *
 * Deliberately excludes, compared to the full CacheModule:
 * - CacheWarmingService (OnModuleInit runs DB queries to pre-populate the
 *   cache on every process boot -- useful once, for the HTTP app; pure
 *   duplicate DB load when it also runs in every RMQ consumer container)
 * - RedisPubSubService (opens two extra Redis connections and subscribes to
 *   the cache-invalidation channel; only meaningful where something actually
 *   publishes/needs cross-instance invalidation)
 * - CacheInvalidationInterceptor as a global APP_INTERCEPTOR (keys off the
 *   @CacheInvalidate decorator, which only HTTP controllers use)
 *
 * RMQ consumer bootstraps (see bootstrap/consumer-infra.module.ts) that don't
 * need those three should import this module instead of CacheModule. A
 * consumer that DOES need them (payment-events, via PaymentsModule) keeps
 * importing the full CacheModule directly -- unchanged.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        // Audit M168: no silent no-password fallback. REDIS_PASSWORD is a
        // required var enforced by validateEnv() at ConfigModule.forRoot - a
        // missing value fails the whole process at boot, not by quietly
        // connecting to Redis with no auth.
        const redisPassword = configService.getOrThrow<string>('REDIS_PASSWORD');

        const redisUrl = `redis://:${redisPassword}@${redisHost}:${redisPort}`;

        return {
          stores: [
            new Keyv({
              store: new KeyvRedis(redisUrl),
              namespace: undefined, // Disable "keyv:" prefix — keys stored as-is so SCAN patterns match
              ttl: 300000, // 5 minutes default
            }),
          ],
        };
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
  ],
  providers: [CacheService, CacheMetricsService],
  exports: [NestCacheModule, CacheService, CacheMetricsService],
})
export class CacheCoreModule {}
