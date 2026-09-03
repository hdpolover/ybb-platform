// src/shared/infrastructure/throttler/throttler.module.spec.ts

import 'reflect-metadata';
import { DynamicModule, FactoryProvider } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { ThrottlerModule } from './throttler.module';
import { clientIpTracker, emailTracker } from './user-aware-throttler.guard';
import { AuthController } from '../../../modules/auth/presentation/auth.controller';

// The module builds a RedisThrottlerStorage in its factory; we only care about
// the throttler names it declares, not about talking to Redis.
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({ on: jest.fn(), defineCommand: jest.fn(), quit: jest.fn() })),
}));

describe('throttler wiring for the auth routes', () => {
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

  // Per-route @Throttle metadata is looked up per THROTTLER NAME, so a route
  // that needs two ceilings has to pin two names. Read the metadata directly:
  // dropping a tier or renaming one is silent at runtime — the guard just
  // stops applying it — and this is the only thing that notices.
  const trackerFor = (handler: unknown, throttler: string) =>
    Reflect.getMetadata(`THROTTLER:TRACKER${throttler}`, handler as object);

  it.each([
    ['login', AuthController.prototype.login],
    ['adminLogin', AuthController.prototype.adminLogin],
    ['ambassadorLogin', AuthController.prototype.ambassadorLogin],
  ])('caps %s per client IP as well as per mailbox', (_name, handler) => {
    // Email keying ALONE is not a limit on a credential route: the caller
    // writes the body, so spraying one password across many accounts never
    // reuses a bucket. The IP tier is the ceiling that actually binds.
    expect(trackerFor(handler, 'default')).toBe(clientIpTracker);
    expect(trackerFor(handler, 'long')).toBe(emailTracker);
  });

  it.each([
    ['register', AuthController.prototype.register],
    ['forgotPassword', AuthController.prototype.forgotPassword],
    ['resendVerification', AuthController.prototype.resendVerification],
  ])('caps %s per mailbox as well as per client IP', (_name, handler) => {
    // These send mail, so the ADDRESS is the resource and deserves its own
    // budget — but one host must still not be able to mint a bucket per
    // address it invents.
    expect(trackerFor(handler, 'default')).toBe(emailTracker);
    expect(trackerFor(handler, 'long')).toBe(clientIpTracker);
  });

  it('leaves register-admin on the guard default, which is the client IP', () => {
    // It used to name clientIpTracker explicitly, to opt OUT of the guard's
    // old body.email default. That default is gone, so naming it would be
    // noise — but if anyone ever pins a tracker here it should not be the
    // caller-chosen mailbox: this route guards a shared secret.
    expect(trackerFor(AuthController.prototype.registerAdmin, 'default')).toBeUndefined();
    expect(trackerFor(AuthController.prototype.registerAdmin, 'default')).not.toBe(emailTracker);
  });
});
