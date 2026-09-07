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
        findUnique: jest.fn((args?: { select?: { sessionToken?: boolean } }) => {
          // The race-loser path re-reads with a narrow `select: {
          // sessionToken: true }` to converge on the winner's token -- keep
          // that call distinct from the normal full-row read.
          if (args?.select?.sessionToken) {
            return Promise.resolve({ sessionToken: (ticket?.sessionToken as string) ?? 'winner-session' });
          }
          return Promise.resolve(ticket);
        }),
        updateMany: jest.fn((args: { data?: Record<string, unknown> }) => {
          // Two distinct guarded updates share this mock: the sessionToken
          // mint-once claim, and the pre-existing consumedAt first-consume
          // guard. Disambiguate on which field the caller is writing.
          if (args.data && 'sessionToken' in args.data) {
            return Promise.resolve({ count: ticket?.sessionToken ? 0 : 1 });
          }
          return Promise.resolve({ count: ticket?.consumedAt ? 0 : 1 });
        }),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser),
        update: jest.fn(),
      },
      userSession: { upsert: jest.fn().mockResolvedValue({}) },
      dataChangeLog: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    // Distinct access/refresh return values so the exact-value assertions below
    // (`res.accessToken`/`res.refreshToken`) pin each token to a specific mock
    // call rather than two calls returning the same constant. Order matches
    // production: accessToken is signed first, refreshToken second
    // (support-access.service.ts exchangeImpersonationToken).
    const jwt = {
      sign: jest.fn().mockReturnValueOnce('access.jwt').mockReturnValueOnce('refresh.jwt'),
    } as unknown as JwtService;
    const config = { get: jest.fn((_k: string, d: string) => d) } as unknown as ConfigService;
    const service = new SupportAccessService(
      prisma as never,
      jwt,
      config,
    );
    return { service, prisma, jwt };
  }

  const baseTicket = {
    id: 'ticket-1',
    adminId: 'admin-1',
    targetUserId: 'user-1',
    tokenHash: 'hash',
    revokedAt: null,
    consumedAt: null,
    sessionToken: null,
    expiresAt: FUTURE,
  };

  it('issues a session for a fresh, unconsumed, in-TTL ticket', async () => {
    const { service, prisma, jwt } = buildService({ ...baseTicket });
    const res = await service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    // A constant mock return value can't tell a correct session apart from one
    // that authenticates as the wrong identity -- assert the signed claims, not
    // just truthiness. The dangerous copy-paste bug here is `sub: ticket.adminId`
    // (the impersonating ADMIN) instead of `sub: user.id` (the actual target
    // participant being impersonated), which would authenticate the session as
    // the admin rather than the participant.
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sub: activeUser.id }),
      expect.anything(),
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sub: activeUser.id }),
      expect.anything(),
    );
    // Exact-value assertions, not `.not.toBe()`: two *distinct* mock values are
    // still distinct after being swapped, so `expect(res.accessToken).not.toBe(
    // res.refreshToken)` cannot detect `accessToken`/`refreshToken` being
    // returned in the wrong slots -- it passes identically whether the service
    // wires them correctly or swaps them. Pinning to the exact literal each
    // mock returns also verifies the signing order production relies on:
    // accessToken is signed first (support-access.service.ts L244), refreshToken
    // second (L255).
    expect(res.accessToken).toBe('access.jwt');
    expect(res.refreshToken).toBe('refresh.jwt');
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

/**
 * Mint idempotency: the ticket CONSUME record was already idempotent
 * (updateMany guarded on consumedAt: null), but MINTING was not -- every
 * redeem inside the 5-minute TTL called randomUUID() again and created a
 * fresh UserSession, so N redeems of one ticket produced N independent,
 * separately-revocable credentials for the same grant. sessionToken is now
 * minted once per TICKET (persisted on first redeem, reused on replay), so
 * N redeems collapse onto ONE session.
 *
 * Uses a stateful fake instead of the per-call mocks above because this
 * behavior is only observable across a SEQUENCE of calls sharing one ticket
 * row -- a fresh mock per call can't tell "reused the old session" from
 * "coincidentally built an equivalent new one".
 */
describe('SupportAccessService.exchangeImpersonationToken mint idempotency', () => {
  const FUTURE = new Date(Date.now() + 60_000);

  const activeUser = {
    id: 'user-1',
    email: 'p@example.com',
    brandId: 'brand-1',
    isActive: true,
    deletedAt: null,
    isOnboardingCompleted: true,
  };

  function buildStatefulService() {
    const ticketRow: Record<string, unknown> = {
      id: 'ticket-1',
      adminId: 'admin-1',
      targetUserId: 'user-1',
      tokenHash: 'hash',
      revokedAt: null,
      consumedAt: null,
      consumedIpAddress: null,
      consumedUserAgent: null,
      sessionToken: null as string | null,
      expiresAt: FUTURE,
    };
    const sessions = new Map<string, Record<string, unknown>>();

    const prisma = {
      supportAccessImpersonationTicket: {
        findUnique: jest.fn((args?: { select?: { sessionToken?: boolean } }) => {
          if (args?.select?.sessionToken) {
            return Promise.resolve({ sessionToken: ticketRow.sessionToken });
          }
          return Promise.resolve({ ...ticketRow });
        }),
        updateMany: jest.fn((args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          if ('sessionToken' in args.data) {
            if (ticketRow.sessionToken !== null) return Promise.resolve({ count: 0 });
            ticketRow.sessionToken = args.data.sessionToken as string;
            return Promise.resolve({ count: 1 });
          }
          // consumedAt first-consume guard: preserve the ORIGINAL consume
          // audit (consumedAt/IP/UA) across replay, exactly like production.
          if (ticketRow.consumedAt !== null) return Promise.resolve({ count: 0 });
          ticketRow.consumedAt = args.data.consumedAt;
          ticketRow.consumedIpAddress = args.data.consumedIpAddress;
          ticketRow.consumedUserAgent = args.data.consumedUserAgent;
          ticketRow.status = args.data.status;
          return Promise.resolve({ count: 1 });
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser),
        update: jest.fn(),
      },
      userSession: {
        upsert: jest.fn((args: { where: { sessionToken: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const existing = sessions.get(args.where.sessionToken);
          const row = existing ? { ...existing, ...args.update } : { ...args.create };
          sessions.set(args.where.sessionToken, row);
          return Promise.resolve(row);
        }),
      },
      dataChangeLog: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const jwt = { sign: jest.fn().mockReturnValue('jwt') } as unknown as JwtService;
    const config = { get: jest.fn((_k: string, d: string) => d) } as unknown as ConfigService;
    const service = new SupportAccessService(prisma as never, jwt, config);
    return { service, prisma, ticketRow, sessions };
  }

  it('N redeems of the same ticket produce exactly one sessionToken and one UserSession row', async () => {
    const { service, prisma, ticketRow, sessions } = buildStatefulService();

    await service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua-1');
    await service.exchangeImpersonationToken('tok', '2.2.2.2', 'ua-2');
    await service.exchangeImpersonationToken('tok', '3.3.3.3', 'ua-3');

    expect(typeof ticketRow.sessionToken).toBe('string');
    // Exactly one session row exists across all three redeems -- create ran
    // once, the other two redeems upserted onto that same key.
    expect(sessions.size).toBe(1);
    expect(prisma.userSession.upsert).toHaveBeenCalledTimes(3);
    // Every upsert targeted the SAME sessionToken (the one minted on redeem 1).
    const targetedTokens = (prisma.userSession.upsert as jest.Mock).mock.calls.map(
      (call) => call[0].where.sessionToken,
    );
    expect(new Set(targetedTokens).size).toBe(1);
    expect(targetedTokens[0]).toBe(ticketRow.sessionToken);
  });

  it('replay preserves the original consume audit (consumedAt/IP/UA) while still refreshing the session', async () => {
    const { service, ticketRow, sessions } = buildStatefulService();

    await service.exchangeImpersonationToken('tok', '1.1.1.1', 'first-ua');
    const firstConsumedAt = ticketRow.consumedAt;
    const sessionToken = ticketRow.sessionToken as string;

    await service.exchangeImpersonationToken('tok', '9.9.9.9', 'second-ua');

    // Ticket's first-consume audit is untouched by the replay.
    expect(ticketRow.consumedAt).toBe(firstConsumedAt);
    expect(ticketRow.consumedIpAddress).toBe('1.1.1.1');
    expect(ticketRow.consumedUserAgent).toBe('first-ua');

    // But the UserSession row DID pick up the replay's ip/browser (design
    // item 2: "refreshing ipAddress/browser/expiresAt" is intentional and
    // distinct from the ticket's frozen first-consume audit).
    const session = sessions.get(sessionToken);
    expect(session?.ipAddress).toBe('9.9.9.9');
    expect(session?.browser).toBe('second-ua');
  });

  it('two concurrent first-redeems converge on one sessionToken instead of erroring', async () => {
    const { service, ticketRow, sessions } = buildStatefulService();

    // Both requests observe ticketRow.sessionToken === null before either
    // write lands; the updateMany's `where: { sessionToken: null }` guard
    // (mirrored by the fake above) lets only one candidate win.
    await Promise.all([
      service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua-a'),
      service.exchangeImpersonationToken('tok', '2.2.2.2', 'ua-b'),
    ]);

    expect(sessions.size).toBe(1);
    expect(typeof ticketRow.sessionToken).toBe('string');
  });
});

describe('SupportAccessService.endImpersonation', () => {
  const superAdminUser = {
    id: 'admin-1',
    accessLevel: 10,
    canManageAdmins: false,
    canAssignRoles: false,
    role: { name: 'Super Admin' },
  };
  const currentUser = { adminId: 'admin-1', role: ['super_admin'] } as never;

  function buildService(ticket: Record<string, unknown> | null) {
    const prisma = {
      admin: { findUnique: jest.fn().mockResolvedValue(superAdminUser) },
      supportAccessImpersonationTicket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      dataChangeLog: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const jwt = {} as JwtService;
    const config = {} as ConfigService;
    const service = new SupportAccessService(prisma as never, jwt, config);
    return { service, prisma };
  }

  const activeTicket = {
    id: 'ticket-1',
    adminId: 'admin-1',
    sessionToken: 'session-1',
    revokedAt: null,
    status: 'consumed',
  };

  it('revokes the ticket and deactivates its UserSession', async () => {
    const { service, prisma } = buildService({ ...activeTicket });
    const res = await service.endImpersonation(currentUser, 'ticket-1');

    expect(res).toEqual({ ended: true });
    expect(prisma.supportAccessImpersonationTicket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1', revokedAt: null },
        data: expect.objectContaining({ status: 'revoked' }),
      }),
    );
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionToken: 'session-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('is idempotent: ending an already-ended ticket is a no-op success, not an error', async () => {
    const { service, prisma } = buildService({ ...activeTicket, revokedAt: new Date() });
    const res = await service.endImpersonation(currentUser, 'ticket-1');

    expect(res).toEqual({ ended: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips the UserSession update when the ticket was never successfully exchanged', async () => {
    const { service, prisma } = buildService({ ...activeTicket, sessionToken: null });
    await service.endImpersonation(currentUser, 'ticket-1');

    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown ticket id', async () => {
    const { service } = buildService(null);
    await expect(service.endImpersonation(currentUser, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
