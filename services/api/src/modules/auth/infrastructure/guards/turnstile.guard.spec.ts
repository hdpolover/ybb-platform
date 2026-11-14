// services/api/src/modules/auth/infrastructure/guards/turnstile.guard.spec.ts
import { ExecutionContext, ForbiddenException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { TurnstileGuard } from './turnstile.guard';

const SECRET = 'test-secret';
const jwt = new JwtService({ secret: SECRET });
const ADMIN_CLAIMS = { sub: 'u1', roles: ['admin', 'super_admin'], adminId: 'a1', type: 'access', jti: 'j1' };

function mkContext(headers: Record<string, string> = {}, adminBypass = true): ExecutionContext {
  const req = { headers, method: 'POST', path: '/v1/auth/resend-verification', ip: '10.0.0.1' };
  const handler = () => undefined;
  if (adminBypass) Reflect.defineMetadata('turnstile:adminBypass', true, handler);
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

function mkGuard(
  env: Record<string, string | undefined>,
  verify: jest.Mock = jest.fn().mockResolvedValue(true),
  revoked: string[] = [],
) {
  const config = { get: (k: string) => env[k] };
  const turnstile = { isConfigured: () => Boolean(env.TURNSTILE_SECRET_KEY), verify };
  const blacklist = { isBlacklisted: jest.fn(async (jti: string) => revoked.includes(jti)) };
  return {
    guard: new TurnstileGuard(config as never, turnstile as never, jwt, new Reflector(), blacklist as never),
    verify,
  };
}

const ENFORCING = { AUTH_TURNSTILE_ENFORCE: 'true', TURNSTILE_SECRET_KEY: 's' };
const DRY_RUN = { TURNSTILE_SECRET_KEY: 's' };

describe('TurnstileGuard', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  describe('not enforcing', () => {
    it('passes without a token and never calls siteverify', async () => {
      const { guard, verify } = mkGuard(DRY_RUN);
      await expect(guard.canActivate(mkContext())).resolves.toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });

    it('logs missing and accepted outcomes with the brand, for the enforce decision', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const { guard } = mkGuard(DRY_RUN);
      await guard.canActivate(mkContext({ 'x-brand-domain': 'chinayouthsummit.com' }));
      await guard.canActivate(mkContext({ 'x-turnstile-token': 'good', 'x-brand-domain': 'chinayouthsummit.com' }));
      expect(log.mock.calls.map((c) => c[0])).toEqual([
        expect.stringMatching(/dry-run missing on POST .* brand=chinayouthsummit\.com/),
        expect.stringMatching(/dry-run accepted on POST .* brand=chinayouthsummit\.com/),
      ]);
      log.mockRestore();
    });

    it('passes a bad token but logs a warning', async () => {
      const { guard, verify } = mkGuard(DRY_RUN, jest.fn().mockResolvedValue(false));
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 'bad' }))).resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('bad', '10.0.0.1');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('passes when siteverify is down, instead of surfacing the 503', async () => {
      const { guard } = mkGuard(DRY_RUN, jest.fn().mockRejectedValue(new ServiceUnavailableException()));
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 't' }))).resolves.toBe(true);
    });

    it('passes a good token without warning', async () => {
      const { guard } = mkGuard(DRY_RUN);
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 'ok' }))).resolves.toBe(true);
      expect(warn).not.toHaveBeenCalled();
    });

    it('does nothing when no secret is configured, even with the flag on and a token sent', async () => {
      const { guard, verify } = mkGuard({ AUTH_TURNSTILE_ENFORCE: 'true' });
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 't' }))).resolves.toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });

    it('treats any value other than the string "true" as off', async () => {
      const { guard } = mkGuard({ ...DRY_RUN, AUTH_TURNSTILE_ENFORCE: '1' });
      await expect(guard.canActivate(mkContext())).resolves.toBe(true);
    });
  });

  describe('enforcing', () => {
    it('403s a request with no token', async () => {
      const { guard, verify } = mkGuard(ENFORCING);
      await expect(guard.canActivate(mkContext())).rejects.toBeInstanceOf(ForbiddenException);
      expect(verify).not.toHaveBeenCalled();
    });

    it('403s an invalid token', async () => {
      const { guard } = mkGuard(ENFORCING, jest.fn().mockResolvedValue(false));
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 'bad' }))).rejects.toThrow(
        'Please complete the security check and try again.',
      );
    });

    it('403s an oversized token without calling siteverify', async () => {
      const { guard, verify } = mkGuard(ENFORCING);
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 'x'.repeat(2049) }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(verify).not.toHaveBeenCalled();
    });

    it('passes a valid token', async () => {
      const { guard, verify } = mkGuard(ENFORCING);
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 'ok' }))).resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('ok', '10.0.0.1');
    });

    it('keeps the 503 when siteverify is unreachable (fail closed)', async () => {
      const { guard } = mkGuard(ENFORCING, jest.fn().mockRejectedValue(new ServiceUnavailableException()));
      await expect(guard.canActivate(mkContext({ 'x-turnstile-token': 't' }))).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('skips Turnstile for a verified admin access token', async () => {
      const { guard, verify } = mkGuard(ENFORCING);
      const authorization = `Bearer ${jwt.sign(ADMIN_CLAIMS)}`;
      await expect(guard.canActivate(mkContext({ authorization }))).resolves.toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });

    it('does NOT skip for an admin token on a route without the bypass marker', async () => {
      const { guard } = mkGuard(ENFORCING);
      const authorization = `Bearer ${jwt.sign(ADMIN_CLAIMS)}`;
      await expect(guard.canActivate(mkContext({ authorization }, false))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does NOT skip for a revoked (logged-out) admin token', async () => {
      const { guard } = mkGuard(ENFORCING, undefined, ['j1']);
      const authorization = `Bearer ${jwt.sign(ADMIN_CLAIMS)}`;
      await expect(guard.canActivate(mkContext({ authorization }))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does NOT skip for a forged token (wrong signature) claiming admin', async () => {
      const { guard } = mkGuard(ENFORCING);
      const forged = new JwtService({ secret: 'attacker' }).sign(ADMIN_CLAIMS);
      await expect(guard.canActivate(mkContext({ authorization: `Bearer ${forged}` }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('does NOT skip for an unsigned or decode-only token claiming admin', async () => {
      const { guard } = mkGuard(ENFORCING);
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(ADMIN_CLAIMS)}.`;
      await expect(guard.canActivate(mkContext({ authorization: `Bearer ${unsigned}` }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('does NOT skip for an expired admin token', async () => {
      const { guard } = mkGuard(ENFORCING);
      const expired = jwt.sign(ADMIN_CLAIMS, { expiresIn: -10 });
      await expect(guard.canActivate(mkContext({ authorization: `Bearer ${expired}` }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it.each([
      ['a participant access token', { sub: 'u2', roles: [], type: 'access' }],
      ['an admin refresh token', { ...ADMIN_CLAIMS, type: 'refresh' }],
      ['an admin token without adminId', { sub: 'u1', roles: ['admin'], type: 'access', jti: 'j2' }],
      ['an admin token without jti', { sub: 'u1', roles: ['admin'], adminId: 'a1', type: 'access' }],
    ])('does NOT skip for %s', async (_label, claims) => {
      const { guard } = mkGuard(ENFORCING);
      const authorization = `Bearer ${jwt.sign(claims)}`;
      await expect(guard.canActivate(mkContext({ authorization }))).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
