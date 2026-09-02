// src/modules/auth/infrastructure/strategies/jwt.strategy.spec.ts

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

describe('JwtStrategy - refresh tokens must not work as bearer tokens', () => {
  let strategy: JwtStrategy;

  const prisma = { user: { findUnique: jest.fn() } };
  const config = { get: jest.fn(() => 'test-secret') };

  const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: 'user-1',
    email: 'someone@example.com',
    brandId: 'brand-1',
    jti: 'jti-1',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true });
    strategy = new JwtStrategy(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
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

  it('still accepts a token with NO type claim at all', async () => {
    // MIGRATION GRACE WINDOW regression guard. Every token minted before the
    // type claim shipped is untyped. If this test ever starts failing because
    // someone tightened validate() to `type !== 'access'`, that is only safe
    // once the longest access TTL (JWT_ADMIN_EXPIRES_IN, 8h in prod) has
    // elapsed since that deploy. Deleting this test is the deliberate act that
    // closes the window; failing it by accident logs out every user at once.
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
