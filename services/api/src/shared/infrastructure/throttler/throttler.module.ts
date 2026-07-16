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
            limit: configService.get<number>('THROTTLE_SHORT_LIMIT', 20),
          },
          {
            name: 'medium',
            ttl: seconds(10),
            limit: configService.get<number>('THROTTLE_MEDIUM_LIMIT', 100),
          },
          {
            name: 'long',
            ttl: seconds(60),
            limit: configService.get<number>('THROTTLE_LONG_LIMIT', 300),
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
