import { Module } from '@nestjs/common';
import { ThrottlerModule as NestThrottlerModule, seconds } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { UserAwareThrottlerGuard } from './user-aware-throttler.guard';

@Module({
  imports: [
    // The guard VERIFIES the Bearer token to bill a request to its user rather
    // than to the whole building behind one NAT, so it needs the same secret
    // the app signs with. Verification is the entire security of that feature:
    // decoding would let any caller pick their own bucket. Same registration as
    // auth.module.ts — module-scoped, so the two do not collide.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          // Boot loudly rather than degrade silently. With no secret,
          // jwt.verify throws "secretOrPublicKey must have a value", the
          // guard's catch swallows it, EVERY request falls back to the IP key
          // — and takes the most expensive path through the guard to get
          // there. Per-user keying would be dead with nothing in the logs to
          // say so. The app cannot sign a token without this value either, so
          // there is no working configuration this refuses.
          // Prior art for env-not-mapped-into-the-container: Dokploy env vars
          // silently killed all cache revalidation (2026-08-23).
          throw new Error(
            'JWT_SECRET is not set: the throttler cannot verify bearer tokens to rate limit per user.',
          );
        }
        return { secret };
      },
      inject: [ConfigService],
    }),
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
