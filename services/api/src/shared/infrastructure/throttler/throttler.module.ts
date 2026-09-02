import { Module } from '@nestjs/common';
import { ThrottlerModule as NestThrottlerModule, seconds } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { UserAwareThrottlerGuard } from './user-aware-throttler.guard';

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
          // Routes decorated with @Throttle({ default: {...} }) or bare
          // @SkipThrottle() only ever address a throttler literally named
          // 'default' (the name the library assigns to an unnamed config).
          // Without this entry those decorators match nothing and are
          // silently ignored, so per-route overrides never take effect.
          {
            name: 'default',
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
      useClass: UserAwareThrottlerGuard,
    },
  ],
  exports: [NestThrottlerModule],
})
export class ThrottlerModule {}
