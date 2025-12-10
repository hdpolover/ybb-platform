import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
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

        return {
          store: await redisStore({
            socket: {
              host: redisHost,
              port: redisPort,
            },
            password: redisPassword || undefined,
            ttl: 300000, // 5 minutes default (in milliseconds for redis-yet)
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

