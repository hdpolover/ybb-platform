// src/shared/infrastructure/throttler/throttler.module.spec.ts

import 'reflect-metadata';
import { DynamicModule, FactoryProvider } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { ThrottlerModule } from './throttler.module';
import { clientIpTracker } from './user-aware-throttler.guard';
import { AuthController } from '../../../modules/auth/presentation/auth.controller';

// The module builds a RedisThrottlerStorage in its factory; we only care about
// the throttler names it declares, not about talking to Redis.
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({ on: jest.fn(), defineCommand: jest.fn(), quit: jest.fn() })),
}));

describe('throttler wiring for the register-admin route', () => {
  it('registers a throttler literally named "default"', async () => {
    // @Throttle({ default: {...} }) addresses a throttler by that exact name.
    // If this entry is renamed or dropped, the decorator on register-admin
    // matches nothing, is silently ignored, and the route falls back to the
    // 300/min 'long' limiter — no error, no log, just an unguarded secret.
    //
    // The factory is invoked directly rather than through Nest's injector so
    // this test stays about the names and does not drag in the whole guard
    // graph.
    const [dynamicModule] = Reflect.getMetadata('imports', ThrottlerModule) as DynamicModule[];
    const optionsProvider = (dynamicModule.providers as FactoryProvider[]).find(
      (provider) => provider.provide === getOptionsToken(),
    );

    const options = (await optionsProvider!.useFactory!({
      get: (_key: string, fallback: unknown) => fallback,
    })) as { throttlers: { name?: string }[] };

    expect(options.throttlers.map((throttler) => throttler.name)).toContain('default');
  });

  it('keys register-admin on the client IP, not on the caller-chosen email', async () => {
    // The route guards a shared secret, so email keying handed every guess a
    // fresh 3-per-hour bucket. Reading the decorator's own metadata means this
    // fails if the tracker is dropped or the throttler name it targets drifts.
    const tracker = Reflect.getMetadata(
      'THROTTLER:TRACKERdefault',
      AuthController.prototype.registerAdmin,
    );

    expect(tracker).toBe(clientIpTracker);
  });
});
