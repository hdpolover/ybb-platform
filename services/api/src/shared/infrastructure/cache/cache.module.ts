import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Keyv from 'keyv';
// @ts-ignore: Wrapper types might be missing locally
import KeyvRedis from '@keyv/redis';
import { CacheService } from './cache.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheWarmingService } from './cache-warming.service';
import { PrismaModule } from '../prisma/prisma.module';

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
          store: new Keyv({
            store: new KeyvRedis(redisUrl),
            ttl: 300000, // 5 minutes default
          }),
        };
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
  ],
  providers: [CacheService, CacheMetricsService, CacheWarmingService],
  exports: [NestCacheModule, CacheService, CacheMetricsService, CacheWarmingService],
})
export class CacheModule { }

