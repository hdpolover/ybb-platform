// src/shared/infrastructure/throttler/throttler.module.spec.ts

import 'reflect-metadata';
import { DynamicModule, FactoryProvider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getOptionsToken } from '@nestjs/throttler';
import { ThrottlerModule } from './throttler.module';
import { createHash } from 'crypto';
import { clientIpTracker, emailTracker, recoveryMailboxBucket } from './user-aware-throttler.guard';
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
  ])('caps %s per client IP on BOTH tiers, never per mailbox', (_name, handler) => {
    // Email keying is wrong on a credential route and used to be here. The
    // caller writes the body, so it was a remote lockout primitive against any
    // known address; the guard increments before the handler, so it counted
    // SUCCESSES; and emailTracker folds +tags and gmail dots, so two distinct
    // user rows shared one login budget. The per-account budget belongs on
    // user.id counting only failures — that is account-lockout.util.ts.
    expect(trackerFor(handler, 'default')).toBe(clientIpTracker);

    // `long` must stay PINNED, and pinned to an IP tier. Leaving the name
    // unset does not remove a ceiling, it inherits the GLOBAL long tier
    // (300/60s with a 60s block), which is tighter than what these routes
    // carry today and lockout-shaped on a CGNAT-heavy auth path.
    expect(trackerFor(handler, 'long')).toBe(clientIpTracker);
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

  describe('the per-inbox mail budget actually aggregates', () => {
    // @nestjs/throttler hashes `ClassName-HandlerName-tierName` into every
    // storage key (throttler.guard.js:148-150), so a tier pinned to N handlers
    // is N independent budgets for the same tracker. That is the whole defect:
    // /auth/forgot-password and /auth/resend-verification each held their own
    // 10-per-hour allowance for one address, so the real ceiling was 20 where
    // the comment said 10.
    //
    // These assert on the KEYS, not on the limits. A test that checked "the
    // mailbox tier caps at 10" passes under both the broken and the fixed code
    // and proves nothing.
    const keyGenFor = (handler: unknown, throttler: string) =>
      Reflect.getMetadata(`THROTTLER:KEY_GENERATOR${throttler}`, handler as object);

    // What the library does when a route pins no generateKey of its own.
    const libraryDefaultKey = (handlerName: string, throttler: string, tracker: string) =>
      createHash('sha256')
        .update(`AuthController-${handlerName}-${throttler}-${tracker}`)
        .digest('hex');

    const keyFor = (handlerName: string, handler: unknown, throttler: string, tracker: string) => {
      const generateKey = keyGenFor(handler, throttler);
      return generateKey
        ? generateKey({} as never, tracker, throttler)
        : libraryDefaultKey(handlerName, throttler, tracker);
    };

    const TRACKER = 'email:victim@gmail.com';

    it('gives forgot-password and resend-verification ONE shared bucket', () => {
      // Against the old code these are two different sha256 digests, because
      // the handler name is inside the hash. This is the assertion that fails.
      const forgot = keyFor('forgotPassword', AuthController.prototype.forgotPassword, 'default', TRACKER);
      const resend = keyFor('resendVerification', AuthController.prototype.resendVerification, 'default', TRACKER);

      expect(forgot).toBe(resend);
    });

    it('keeps /register on its OWN bucket, deliberately', () => {
      // Not an oversight. The guard runs before the ValidationPipe, so every
      // signup 400/409 spends mailbox budget without sending mail, and
      // blockDuration falls through to the one-hour ttl. Sharing would let
      // eleven junk POSTs carrying only {email} block that inbox's password
      // reset for an hour — and password reset is the only self-service escape
      // from an account lockout.
      const register = keyFor('register', AuthController.prototype.register, 'default', TRACKER);
      const forgot = keyFor('forgotPassword', AuthController.prototype.forgotPassword, 'default', TRACKER);

      expect(register).not.toBe(forgot);
    });

    it('leaves the per-IP tier split per route, so no building loses ceiling', () => {
      // Converging this one would cut a school lab's allowance threefold —
      // the 2026-08-31 lockout shape. It must stay per-handler.
      const forgot = keyFor('forgotPassword', AuthController.prototype.forgotPassword, 'long', 'ip:1.2.3.4');
      const resend = keyFor('resendVerification', AuthController.prototype.resendVerification, 'long', 'ip:1.2.3.4');

      expect(forgot).not.toBe(resend);
    });

    it('hashes, and never returns the raw mailbox as a Redis key', () => {
      // throttler.guard.js:116 hands this value straight to storage. Returning
      // the tracker verbatim would write plaintext user mailboxes into Redis
      // keys, visible to anything that can run KEYS.
      const key = recoveryMailboxBucket({} as never, TRACKER, 'default');

      expect(key).not.toContain('victim@gmail.com');
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('does not reference `this`, because the guard calls it unbound', () => {
      // throttler.guard.js:115 calls `generateKey(context, tracker, name)` as a
      // bare function. A `this` in there would be undefined and every request
      // on these routes would 500 — a rate limiter causing the outage.
      const detached = recoveryMailboxBucket;

      expect(() => detached({} as never, TRACKER, 'default')).not.toThrow();
    });
  });
});
