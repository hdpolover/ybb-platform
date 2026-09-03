// src/modules/auth/infrastructure/strategies/jwt.strategy.spec.ts

import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, JwtStrategy, parseTtlSeconds } from './jwt.strategy';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

describe('JwtStrategy - refresh tokens must not work as bearer tokens', () => {
  let strategy: JwtStrategy;

  const prisma = { user: { findUnique: jest.fn() } };

  // Production values. JWT_ADMIN_EXPIRES_IN is the longest ACCESS ttl, so it
  // is the one the lifetime check has to be derived from.
  let config: Record<string, string>;
  const configService = {
    get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
  };

  const HOUR = 3600;
  const NOW = 1_760_000_000;

  const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: 'user-1',
    email: 'someone@example.com',
    brandId: 'brand-1',
    jti: 'jti-1',
    ...overrides,
  });

  /** An untyped legacy token, described by how long it lives. */
  const legacyTokenLasting = (seconds: number): JwtPayload =>
    payload({ iat: NOW, exp: NOW + seconds });

  const build = () =>
    new JwtStrategy(configService as unknown as ConfigService, prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
      JWT_ADMIN_EXPIRES_IN: '8h',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true });
    strategy = build();
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepts a token explicitly marked as an access token', async () => {
    const result = await strategy.validate(payload({ type: 'access', roles: ['admin'] }));

    expect(result).toEqual(expect.objectContaining({ userId: 'user-1', role: ['admin'] }));
  });

  it('rejects a refresh token presented as a bearer token', async () => {
    // Both halves are signed with the same secret, so before the type claim a
    // stolen refresh token was a 7-day API key that logout could not revoke.
    await expect(strategy.validate(payload({ type: 'refresh' }))).rejects.toThrow(
      UnauthorizedException,
    );

    // Rejected before the user lookup — no DB round trip for a token we know is wrong.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an untyped token that lives longer than any access token can', async () => {
    // The self-closing half of the migration. A legacy refresh token has no
    // type claim, but it does carry a 7-day lifetime, and nothing ever mints
    // an access token for that long. No human has to come back and tighten
    // anything for this to stop working.
    await expect(strategy.validate(legacyTokenLasting(7 * 24 * HOUR))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('accepts an untyped token with a normal 1h access lifetime', async () => {
    const result = await strategy.validate(legacyTokenLasting(HOUR));

    expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
  });

  it('accepts an untyped token that lives exactly the longest configured access ttl', async () => {
    // Boundary: 8h is JWT_ADMIN_EXPIRES_IN, a legitimate admin access token.
    const result = await strategy.validate(legacyTokenLasting(8 * HOUR));

    expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
  });

  it('warns loudly when the access ttl reaches the refresh ttl, instead of silently not protecting', async () => {
    // .env and .env.staging used to set JWT_EXPIRES_IN=7d, the same as the
    // refresh ttl, which leaves the check no gap to discriminate on: it runs
    // on every request and can never reject anything. The previous version of
    // this spec asserted that shape was CORRECT, which documented the hole
    // instead of reporting it.
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    config.JWT_EXPIRES_IN = '7d';
    strategy = build();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('JWT_REFRESH_EXPIRES_IN'),
    );

    // ...and it does indeed wave the legacy refresh token through, which is
    // why the warning has to exist.
    const result = await strategy.validate(legacyTokenLasting(7 * 24 * HOUR));
    expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
  });

  it('does not warn on prod-shaped config, where the check can actually discriminate', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    strategy = build(); // 1h / 8h access, 7d refresh

    expect(warn).not.toHaveBeenCalled();
    await expect(strategy.validate(legacyTokenLasting(7 * 24 * HOUR))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts the whole duration grammar the signer accepts', async () => {
    // jsonwebtoken feeds `expiresIn` to `ms`, so anything ms takes is a legal
    // TTL. The hand-rolled parser this replaces returned undefined for all of
    // these and fell back to a threshold far below the real one, which 401'd
    // every admin token for its entire life.
    config.JWT_ADMIN_EXPIRES_IN = '12 hours';
    strategy = build();

    const result = await strategy.validate(legacyTokenLasting(12 * HOUR));

    expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
  });

  it('reads a bare number as milliseconds, the same as the signer does', () => {
    // The old parser read '3600' as 3600 SECONDS; jsonwebtoken reads it as
    // 3.6 seconds. Agreeing with the signer matters more than the value being
    // sensible.
    expect(parseTtlSeconds('3600')).toBe(3.6);
    expect(parseTtlSeconds('1w')).toBe(7 * 24 * HOUR);
    expect(parseTtlSeconds('10.5h')).toBe(10.5 * HOUR);
    expect(parseTtlSeconds('2 days')).toBe(2 * 24 * HOUR);
  });

  it('disables the lifetime check rather than locking everyone out when the ttl is unparseable', async () => {
    // Fail OPEN. A typo in an env var must not turn into "every token is
    // rejected for its whole life" with an error message that blames the
    // token.
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    config.JWT_ADMIN_EXPIRES_IN = 'eight hours';
    strategy = build();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('JWT_ADMIN_EXPIRES_IN'));

    const result = await strategy.validate(legacyTokenLasting(7 * 24 * HOUR));
    expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
  });

  it('still rejects an explicitly typed refresh token when the check is disabled', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    config.JWT_ADMIN_EXPIRES_IN = 'eight hours';
    strategy = build();

    await expect(strategy.validate(payload({ type: 'refresh' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('still accepts an untyped token that carries neither iat nor exp', async () => {
    // Unclassifiable, so it gets the benefit of the doubt: inventing a lockout
    // for a shape we cannot judge costs real users their session and gains
    // nothing an attacker could not sidestep by omitting the claims anyway
    // (jsonwebtoken always stamps iat, so this shape is not reachable from our
    // own sign sites).
    const result = await strategy.validate(payload());

    expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
  });

  it('still rejects an inactive user regardless of token type', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: false });

    await expect(strategy.validate(payload({ type: 'access' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
