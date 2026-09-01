import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { CacheService } from './cache.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheWarmingService } from './cache-warming.service';
import { RedisPubSubService } from '../redis/redis-pubsub.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheInvalidationInterceptor } from '../../interceptors/cache-invalidation.interceptor';

@Global()
@Module({
  imports: [
    PrismaModule,
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD', '');

        const redisUrl = redisPassword
          ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
          : `redis://${redisHost}:${redisPort}`;

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
  providers: [
    CacheService,
    CacheMetricsService,
    CacheWarmingService,
    RedisPubSubService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInvalidationInterceptor,
    },
  ],
  exports: [NestCacheModule, CacheService, CacheMetricsService, CacheWarmingService, RedisPubSubService],
})
export class CacheModule { }

