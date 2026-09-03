// src/modules/auth/application/commands/handlers/admin-refresh.handler.spec.ts

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminRefreshHandler } from './admin-refresh.handler';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

describe('AdminRefreshHandler - only a refresh token may refresh', () => {
  let handler: AdminRefreshHandler;

  const prisma = { userSession: { findFirst: jest.fn() } };
  const jwtService = { verify: jest.fn(), sign: jest.fn(() => 'signed') };
  const configService = { get: jest.fn((_key: string, fallback?: string) => fallback) };

  const validClaims = {
    sub: 'user-1',
    email: 'admin@example.com',
    brandId: 'brand-1',
    adminId: 'admin-1',
    sid: 'session-token-1',
    isAdmin: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSession.findFirst.mockResolvedValue(null);
    handler = new AdminRefreshHandler(
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
    // Both halves are signed with the same secret. Without this check an
    // access token that happened to carry a sid could be replayed here to mint
    // a fresh pair, which would outlive the logout blacklist.
    jwtService.verify.mockReturnValue({ ...validClaims, type: 'access' });

    await expect(handler.execute('access-token')).rejects.toThrow(UnauthorizedException);
    expect(prisma.userSession.findFirst).not.toHaveBeenCalled();
  });

  it('accepts an explicit refresh token as far as the session lookup', async () => {
    jwtService.verify.mockReturnValue({ ...validClaims, type: 'refresh' });

    await expect(handler.execute('refresh-token')).rejects.toThrow('Refresh session is not valid');
    expect(prisma.userSession.findFirst).toHaveBeenCalled();
  });

  it('still accepts a legacy token with no type claim', async () => {
    // Refresh tokens minted before the claim shipped carry no type. Rejecting
    // those would bounce every admin to the login screen; the session-row
    // lookup below is what actually authorises the refresh anyway, and an
    // access token never matches the stored refreshToken column.
    jwtService.verify.mockReturnValue(validClaims);

    await expect(handler.execute('legacy-token')).rejects.toThrow('Refresh session is not valid');
    expect(prisma.userSession.findFirst).toHaveBeenCalled();
  });

  it('rejects a refresh token that is not an admin token', async () => {
    jwtService.verify.mockReturnValue({ ...validClaims, isAdmin: false, type: 'refresh' });

    await expect(handler.execute('participant-token')).rejects.toThrow(UnauthorizedException);
    expect(prisma.userSession.findFirst).not.toHaveBeenCalled();
  });
});
