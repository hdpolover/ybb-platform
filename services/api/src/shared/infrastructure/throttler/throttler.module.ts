import { Module } from '@nestjs/common';
import { ThrottlerModule as NestThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: seconds(1),
            limit: 3, // 3 requests per second
          },
          {
            name: 'medium',
            ttl: seconds(10),
            limit: 20, // 20 requests per 10 seconds
          },
          {
            name: 'long',
            ttl: seconds(60),
            limit: 100, // 100 requests per minute
          },
        ],
        storage: new RedisThrottlerStorage(
          configService.get<string>('REDIS_HOST', 'localhost'),
          configService.get<number>('REDIS_PORT', 6379),
          configService.get<string>('REDIS_PASSWORD', ''),
        ),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [NestThrottlerModule],
})
export class ThrottlerModule {}
