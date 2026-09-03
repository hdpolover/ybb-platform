// src/shared/infrastructure/throttler/throttler.module.spec.ts

import 'reflect-metadata';
import { DynamicModule, FactoryProvider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
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
    // Found by token, not by position: the module also imports JwtModule (the
    // guard verifies bearer tokens), so indexing imports[0] would silently pick
    // the wrong one.
    const optionsProvider = (Reflect.getMetadata('imports', ThrottlerModule) as DynamicModule[])
      .flatMap((dynamicModule) => (dynamicModule.providers ?? []) as FactoryProvider[])
      .find((provider) => provider?.provide === getOptionsToken());

    const options = (await optionsProvider!.useFactory!({
      get: (_key: string, fallback: unknown) => fallback,
    })) as { throttlers: { name?: string }[] };

    expect(options.throttlers.map((throttler) => throttler.name)).toContain('default');
  });

  // The JwtModule factory, found by the token the guard injects rather than by
  // position, so adding an import cannot silently point this at the wrong one.
  const jwtFactory = () => {
    const provider = (Reflect.getMetadata('imports', ThrottlerModule) as DynamicModule[])
      .flatMap((dynamicModule) => (dynamicModule.providers ?? []) as FactoryProvider[])
      .find((candidate) => typeof candidate?.useFactory === 'function' && candidate.provide !== getOptionsToken());
    return provider!.useFactory! as (config: { get: (key: string) => unknown }) => Promise<unknown>;
  };

  it.each([[undefined], ['']])('refuses to boot when JWT_SECRET is %p', async (secret) => {
    // Without a secret, jwt.verify throws "secretOrPublicKey must have a
    // value", the guard's catch swallows it, and per-user keying is dead on
    // every request while each one takes the guard's MOST expensive path to
    // find that out. Nothing in the logs would say so. The app cannot sign a
    // token without this value either, so there is no working configuration
    // this refuses. Prior art: a Dokploy env var that never reached the
    // container silently killed all cache revalidation (2026-08-23).
    await expect(jwtFactory()({ get: () => secret })).rejects.toThrow(/JWT_SECRET/);
  });

  it('boots with a secret present', async () => {
    await expect(jwtFactory()({ get: () => 'a-secret' })).resolves.toEqual({ secret: 'a-secret' });
  });

  it('makes JwtService resolvable where the guard is constructed', async () => {
    // The guard takes JwtService as a 4th constructor argument to VERIFY bearer
    // tokens. Nothing else in the suite touches the real injector, so a missing
    // JwtModule import would be invisible to tsc and to every unit test, and
    // would surface as a container crash on boot.
    // ignoreEnvFile means the factory sees only process.env, and the factory
    // now refuses to build without a secret — which is the point of the test
    // above.
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'throttler-module-spec-secret';
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), ThrottlerModule],
      }).compile();

      expect(moduleRef.select(ThrottlerModule).get(JwtService)).toBeInstanceOf(JwtService);
      await moduleRef.close();
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
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

  it('pins register-admin to the client IP, never the guard default', () => {
    // This assertion exists because the opposite one used to be here, and it
    // was wrong. The guard's default tracker is USER-aware, and /auth/register
    // hands out an access token with no email verification — so inheriting the
    // default would let a caller mint throwaway accounts and spend a fresh
    // 3-guess bucket per account against the shared admin secret, thousands of
    // guesses an hour against an intended 3.
    // The cap on this route is only meaningful if the bucket is something the
    // caller cannot mint. That is the client IP, and it must stay named here.
    expect(trackerFor(AuthController.prototype.registerAdmin, 'default')).toBe(clientIpTracker);
    expect(trackerFor(AuthController.prototype.registerAdmin, 'default')).not.toBe(emailTracker);
  });
});
