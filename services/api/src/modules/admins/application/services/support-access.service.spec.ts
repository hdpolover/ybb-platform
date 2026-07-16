import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupportAccessService } from './support-access.service';

/**
 * Focused tests for exchangeImpersonationToken idempotency.
 *
 * The impersonation login URL can be loaded more than once per token (React
 * StrictMode remount, new-tab prefetch, link/URL scanners). A single-use token
 * that hard-fails on the second redeem produced "Invalid or expired token" in the
 * real tab. The exchange must therefore be idempotent within the ticket TTL:
 * a consumed-but-not-expired, not-revoked ticket still issues a session.
 */
describe('SupportAccessService.exchangeImpersonationToken', () => {
  const FUTURE = new Date(Date.now() + 60_000);
  const PAST = new Date(Date.now() - 60_000);

  const activeUser = {
    id: 'user-1',
    email: 'p@example.com',
    brandId: 'brand-1',
    isActive: true,
    deletedAt: null,
    isOnboardingCompleted: true,
  };

  function buildService(ticket: Record<string, unknown> | null) {
    const prisma = {
      supportAccessImpersonationTicket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        updateMany: jest.fn().mockResolvedValue({ count: ticket?.consumedAt ? 0 : 1 }),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser),
        update: jest.fn(),
      },
      userSession: { create: jest.fn() },
      dataChangeLog: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') } as unknown as JwtService;
    const config = { get: jest.fn((_k: string, d: string) => d) } as unknown as ConfigService;
    const service = new SupportAccessService(
      prisma as never,
      jwt,
      config,
    );
    return { service, prisma };
  }

  const baseTicket = {
    id: 'ticket-1',
    adminId: 'admin-1',
    targetUserId: 'user-1',
    tokenHash: 'hash',
    revokedAt: null,
    consumedAt: null,
    expiresAt: FUTURE,
  };

  it('issues a session for a fresh, unconsumed, in-TTL ticket', async () => {
    const { service, prisma } = buildService({ ...baseTicket });
    const res = await service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.redirectTo).toBe('/dashboard');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: a consumed but in-TTL, not-revoked ticket still issues a session (no throw)', async () => {
    const { service, prisma } = buildService({ ...baseTicket, consumedAt: PAST });
    const res = await service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua');
    expect(res.accessToken).toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('throws for an unknown token', async () => {
    const { service } = buildService(null);
    await expect(service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws for a revoked ticket', async () => {
    const { service } = buildService({ ...baseTicket, revokedAt: PAST });
    await expect(service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws for an expired ticket even if not yet consumed', async () => {
    const { service } = buildService({ ...baseTicket, expiresAt: PAST });
    await expect(service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws NotFound when the target user is inactive', async () => {
    const { service, prisma } = buildService({ ...baseTicket });
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });
    await expect(service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
