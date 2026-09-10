// src/modules/auth/application/commands/handlers/refresh.handler.spec.ts

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshHandler } from './refresh.handler';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { hashToken } from '@shared/utils/hash-token.util';

describe('RefreshHandler - only a refresh token may refresh', () => {
  let handler: RefreshHandler;

  const prisma = { userSession: { findFirst: jest.fn() } };
  const jwtService = { verify: jest.fn(), sign: jest.fn(() => 'signed') };
  const configService = { get: jest.fn((_key: string, fallback?: string) => fallback) };

  const validClaims = {
    sub: 'user-1',
    email: 'participant@example.com',
    brandId: 'brand-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSession.findFirst.mockResolvedValue(null);
    handler = new RefreshHandler(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('rejects a token that does not verify', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await expect(handler.execute('nonsense')).rejects.toThrow(UnauthorizedException);
    expect(prisma.userSession.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an access token presented at the refresh endpoint', async () => {
    // Without this check an access token could be replayed here to mint a
    // fresh pair, which would outlive the logout blacklist.
    jwtService.verify.mockReturnValue({ ...validClaims, type: 'access' });

    await expect(handler.execute('access-token')).rejects.toThrow(UnauthorizedException);
    expect(prisma.userSession.findFirst).not.toHaveBeenCalled();
  });

  it('accepts an explicit refresh token as far as the session lookup', async () => {
    jwtService.verify.mockReturnValue({ ...validClaims, type: 'refresh' });

    await expect(handler.execute('refresh-token')).rejects.toThrow('Refresh session is not valid');
    expect(prisma.userSession.findFirst).toHaveBeenCalled();
  });

  it('still accepts a legacy token with no type claim (grace window)', async () => {
    // All six login/register sign sites now stamp type:'refresh', but tokens
    // issued before this deploy carry no type at all. Rejecting those would
    // bounce every participant mid-application to the login screen; the
    // session-row lookup below is what actually authorises the refresh
    // anyway, and an access token never matches the stored refreshToken
    // column.
    jwtService.verify.mockReturnValue(validClaims);

    await expect(handler.execute('legacy-token')).rejects.toThrow('Refresh session is not valid');
    expect(prisma.userSession.findFirst).toHaveBeenCalled();
  });

  it('looks the session up by userId only, not sessionToken - participant refresh payloads carry no sid', async () => {
    jwtService.verify.mockReturnValue({ ...validClaims, type: 'refresh' });

    await expect(handler.execute('refresh-token')).rejects.toThrow();

    const callArgs = prisma.userSession.findFirst.mock.calls[0][0];
    expect(callArgs.where.userId).toBe('user-1');
    expect(callArgs.where.sessionToken).toBeUndefined();
  });

  it('rejects when the session or its user cannot be found', async () => {
    prisma.userSession.findFirst.mockResolvedValue(null);
    jwtService.verify.mockReturnValue({ ...validClaims, type: 'refresh' });

    await expect(handler.execute('refresh-token')).rejects.toThrow('Refresh session is not valid');
  });

  it('rejects when the user account is inactive', async () => {
    prisma.userSession.findFirst.mockResolvedValue({
      id: 'session-row-1',
      sessionToken: 'session-token-1',
      refreshToken: 'presented-refresh-token',
      user: {
        id: 'user-1',
        email: 'participant@example.com',
        brandId: 'brand-1',
        isActive: false,
        isOnboardingCompleted: false,
        admin: null,
      },
    });
    jwtService.verify.mockReturnValue({ ...validClaims, type: 'refresh' });

    await expect(handler.execute('presented-refresh-token')).rejects.toThrow(
      'Refresh session is not valid',
    );
  });
});

describe('RefreshHandler - rotation is a guarded updateMany, not find-then-update', () => {
  let handler: RefreshHandler;

  const fullSession = {
    id: 'session-row-1',
    sessionToken: 'session-token-1',
    refreshToken: 'presented-refresh-token',
    user: {
      id: 'user-1',
      email: 'participant@example.com',
      brandId: 'brand-1',
      isActive: true,
      isOnboardingCompleted: true,
      admin: null,
    },
  };

  const prisma = {
    userSession: { findFirst: jest.fn(), updateMany: jest.fn() },
  };
  const jwtService = { verify: jest.fn(), sign: jest.fn((_payload?: unknown, _opts?: unknown) => 'signed-token') };
  const configService = { get: jest.fn((_key: string, fallback?: string) => fallback) };

  const validClaims = {
    sub: 'user-1',
    email: 'participant@example.com',
    brandId: 'brand-1',
    type: 'refresh' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.verify.mockReturnValue(validClaims);
    prisma.userSession.findFirst.mockResolvedValue(fullSession);
    handler = new RefreshHandler(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('rotates via updateMany guarded on BOTH session id and the matched refreshToken value, and stores the new token hashed', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute('presented-refresh-token');

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-row-1', refreshToken: 'presented-refresh-token' },
      data: expect.objectContaining({ refreshToken: hashToken('signed-token') }),
    });
    expect(prisma.userSession.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-row-1' } }),
    );
  });

  it('takes the count===0 path (fails closed with 401) when a concurrent refresh already rotated the token', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute('presented-refresh-token')).rejects.toThrow(
      'Refresh session is not valid',
    );
  });

  it('proceeds normally and returns a token pair when the rotation wins the race (count===1)', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await handler.execute('presented-refresh-token');

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'participant@example.com',
      brandId: 'brand-1',
      isActive: true,
      isOnboardingCompleted: true,
    });
  });

  it('stamps the new access token with sid from the session row, not from the (sid-less) refresh payload', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute('presented-refresh-token');

    const accessTokenCall = jwtService.sign.mock.calls[0];
    expect(accessTokenCall[0]).toEqual(
      expect.objectContaining({ sid: 'session-token-1', type: 'access' }),
    );
  });

  it('computes roles the way login.handler.ts does: empty for a non-admin user', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute('presented-refresh-token');

    const accessTokenPayload = jwtService.sign.mock.calls[0][0] as { roles: string[] };
    expect(accessTokenPayload.roles).toEqual([]);
  });

  it('computes roles the way login.handler.ts does: admin + matching brand roleInBrand', async () => {
    prisma.userSession.findFirst.mockResolvedValue({
      ...fullSession,
      user: {
        ...fullSession.user,
        admin: {
          adminBrands: [
            { brandId: 'brand-1', roleInBrand: 'coordinator' },
            { brandId: 'brand-2', roleInBrand: 'reviewer' },
          ],
        },
      },
    });
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute('presented-refresh-token');

    const accessTokenPayload = jwtService.sign.mock.calls[0][0] as { roles: string[] };
    expect(accessTokenPayload.roles).toEqual(['admin', 'coordinator']);
  });
});
