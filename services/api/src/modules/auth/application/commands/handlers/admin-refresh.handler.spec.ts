// src/modules/auth/application/commands/handlers/admin-refresh.handler.spec.ts

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminRefreshHandler } from './admin-refresh.handler';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { hashToken } from '@shared/utils/hash-token.util';

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

describe('AdminRefreshHandler - rotation is a guarded updateMany, not find-then-update (M132)', () => {
  let handler: AdminRefreshHandler;

  // Audit M144 (widened): a legacy row that has not migrated to hashed
  // storage yet still holds the raw refreshToken value. The dual-read in
  // the handler matches this via the plaintext arm of the findFirst OR.
  const fullSession = {
    id: 'session-row-1',
    sessionToken: 'session-token-1',
    refreshToken: 'presented-refresh-token',
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      brandId: 'brand-1',
      isActive: true,
      isOnboardingCompleted: true,
      admin: {
        id: 'admin-1',
        fullName: 'Admin One',
        avatarUrl: null,
        roleId: null,
        role: null,
        // accessLevel 5 -> 'platform' scope, the branch that queries
        // program.findMany rather than mapping adminPrograms — keeps this
        // fixture minimal (see ADMIN_SCOPE_FIXTURES for why the 'assigned'
        // scope needs a much heavier fixture this test does not need).
        accessLevel: 5,
        customPermissions: null,
        canManageAdmins: false,
        canAssignRoles: false,
        adminBrands: [],
        adminPrograms: [],
      },
    },
  };

  const prisma = {
    userSession: { findFirst: jest.fn(), updateMany: jest.fn() },
    program: { findMany: jest.fn() },
  };
  const jwtService = { verify: jest.fn(), sign: jest.fn(() => 'signed-token') };
  const configService = { get: jest.fn((_key: string, fallback?: string) => fallback) };

  const validClaims = {
    sub: 'user-1',
    email: 'admin@example.com',
    brandId: 'brand-1',
    adminId: 'admin-1',
    sid: 'session-token-1',
    isAdmin: true,
    type: 'refresh' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.verify.mockReturnValue(validClaims);
    prisma.userSession.findFirst.mockResolvedValue(fullSession);
    prisma.program.findMany.mockResolvedValue([]);
    handler = new AdminRefreshHandler(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('rotates via updateMany guarded on BOTH session id and the matched refreshToken value, and stores the new token hashed', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute('presented-refresh-token');

    // The where guard is session.refreshToken (whatever value the findFirst
    // actually matched on - here the legacy plaintext value), not the raw
    // presented token or its hash directly, so a still-unmigrated row's
    // concurrency guard keeps working. The stored value for the NEW token
    // is always the hash, never the raw JWT (Audit M144 widened).
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-row-1', refreshToken: 'presented-refresh-token' },
      data: expect.objectContaining({ refreshToken: hashToken('signed-token') }),
    });
    // A plain update-by-id (no refreshToken predicate) is exactly the bug:
    // it would let a second concurrent refresh silently overwrite the first.
    expect(prisma.userSession.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-row-1' } }),
    );
  });

  it('looks up the session by hash first, falling back to plaintext, so an already-migrated row is matched by hash', async () => {
    // Once a row has rotated once post-deploy it holds a hash, not the raw
    // JWT. The findFirst's OR clause must include the hash of the presented
    // token so a migrated row is still found without ever falling through
    // to (and needlessly exposing) the plaintext arm.
    prisma.userSession.findFirst.mockResolvedValue({
      ...fullSession,
      refreshToken: hashToken('presented-refresh-token'),
    });
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute('presented-refresh-token');

    expect(prisma.userSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { refreshToken: hashToken('presented-refresh-token') },
            { refreshToken: 'presented-refresh-token' },
          ],
        }),
      }),
    );
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-row-1', refreshToken: hashToken('presented-refresh-token') },
      data: expect.objectContaining({ refreshToken: hashToken('signed-token') }),
    });
  });

  it('takes the count===0 path (fails closed with 401) when a concurrent refresh already rotated the token', async () => {
    // Simulates two tabs refreshing at once: this request's updateMany finds
    // zero matching rows because the OTHER request's write already changed
    // refreshToken out from under the where clause's guard.
    prisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute('presented-refresh-token')).rejects.toThrow(
      'Refresh session is not valid',
    );

    // Must not proceed to build/return a token pair off a rotation that lost
    // the race — no accessible-programs lookup, no successful response.
    expect(prisma.program.findMany).not.toHaveBeenCalled();
  });

  it('proceeds normally and returns a token pair when the rotation wins the race (count===1)', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await handler.execute('presented-refresh-token');

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
  });
});
