// services/api/src/modules/admins/application/services/support-access.read-only.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupportAccessService } from './support-access.service';

/**
 * Read-only customer-support view: a non-super admin holding `support:impersonate`
 * on the participant's program gets a ticket without the shared support secret;
 * redeeming it yields a 30 minute access token with NO refresh token.
 */
describe('SupportAccessService read-only support view', () => {
  const dto = { participantId: 'part-1', programId: 'prog-1', reason: 'Participant cannot see invoice' };
  const actor = { adminId: 'admin-1', userId: 'u-admin', email: 'a@x.com', brandId: 'b1', role: ['admin'] };
  const program = { id: 'prog-1', brandId: 'brand-1', name: 'P', deletedAt: null };
  const participant = {
    id: 'part-1',
    user: {
      id: 'user-1',
      email: 'p@example.com',
      brandId: 'brand-1',
      brand: { websiteUrl: 'https://portal.example.com', landingUrl: null },
    },
  };

  const supportAdmin = (overrides: Record<string, unknown> = {}) => ({
    id: 'admin-1',
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'support', permissions: ['support:impersonate'] },
    adminPrograms: [{ programId: 'prog-1', permissions: [] }],
    ...overrides,
  });

  function build(admin: Record<string, unknown>, opts: { inProgram?: boolean; enabled?: boolean } = {}) {
    const prisma = {
      admin: { findUnique: jest.fn().mockResolvedValue(admin) },
      // isEnabled only: the read-only path never reads or checks the secret hash.
      supportAccessConfig: { findUnique: jest.fn().mockResolvedValue({ isEnabled: opts.enabled ?? true, secretHash: null }) },
      participant: { findUnique: jest.fn().mockResolvedValue(participant) },
      participantApplication: {
        findFirst: jest.fn().mockResolvedValue(opts.inProgram === false ? null : { id: 'app-1' }),
      },
      supportAccessImpersonationTicket: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'ticket-1',
          ...data,
        })),
      },
      dataChangeLog: { create: jest.fn() },
    };
    const prismaRead = {
      admin: { findUnique: jest.fn().mockResolvedValue(admin) },
      program: { findUnique: jest.fn().mockResolvedValue(program) },
    };
    const jwt = { sign: jest.fn().mockReturnValue('signed.jwt') } as unknown as JwtService;
    const config = {
      get: jest.fn((_k: string, d?: string) => d),
    } as unknown as ConfigService;
    const service = new SupportAccessService(prisma as never, jwt, config, prismaRead as never);
    return { service, prisma, jwt };
  }

  describe('createImpersonation (non-super)', () => {
    it('creates a read_only ticket without a support secret and audits the mode', async () => {
      const { service, prisma } = build(supportAdmin());
      const res = await service.createImpersonation(actor, dto as never, '1.1.1.1', 'ua');

      expect(res.loginUrl).toContain('https://portal.example.com/admin-impersonation?token=');
      expect(prisma.supportAccessImpersonationTicket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ mode: 'read_only', targetProgramId: 'prog-1', adminId: 'admin-1' }),
      });
      expect(prisma.dataChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          afterState: expect.objectContaining({ mode: 'read_only' }),
        }),
      });
    });

    it('403 when the owner has switched support access off', async () => {
      const { service, prisma } = build(supportAdmin(), { enabled: false });
      await expect(service.createImpersonation(actor, dto as never, '1.1.1.1', 'ua')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.supportAccessImpersonationTicket.create).not.toHaveBeenCalled();
    });

    it('403 for a platform-tier admin who does not hold support:impersonate explicitly', async () => {
      const platformAdmin = supportAdmin({
        role: { name: 'Platform Admin', permissions: ['platform_access', 'platform.manage', 'program:read'] },
      });
      const { service, prisma } = build(platformAdmin);
      await expect(service.createImpersonation(actor, dto as never, '1.1.1.1', 'ua')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.supportAccessImpersonationTicket.create).not.toHaveBeenCalled();
    });

    it('allows a platform-tier admin who holds support:impersonate as an extra', async () => {
      const platformAdmin = supportAdmin({
        role: { name: 'Platform Admin', permissions: ['platform_access', 'platform.manage'] },
        customPermissions: ['support:impersonate'],
      });
      const { service, prisma } = build(platformAdmin);
      await service.createImpersonation(actor, dto as never, '1.1.1.1', 'ua');
      expect(prisma.supportAccessImpersonationTicket.create).toHaveBeenCalled();
    });

    it('403 when the admin lacks support:impersonate', async () => {
      const { service, prisma } = build(
        supportAdmin({ role: { name: 'support', permissions: ['participants:read'] } }),
      );
      await expect(service.createImpersonation(actor, dto as never, 'ip', 'ua')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.supportAccessImpersonationTicket.create).not.toHaveBeenCalled();
    });

    it('404 when the program is outside the admin assignments, even holding the permission', async () => {
      const { service, prisma } = build(supportAdmin({ adminPrograms: [{ programId: 'other', permissions: [] }] }));
      await expect(service.createImpersonation(actor, dto as never, 'ip', 'ua')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.supportAccessImpersonationTicket.create).not.toHaveBeenCalled();
    });

    it('404 when the participant has no application in that program', async () => {
      const { service } = build(supportAdmin(), { inProgram: false });
      await expect(service.createImpersonation(actor, dto as never, 'ip', 'ua')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('requires programId and participantId on the read-only path', async () => {
      const { service } = build(supportAdmin());
      await expect(
        service.createImpersonation(actor, { ...dto, programId: undefined } as never, 'ip', 'ua'),
      ).rejects.toThrow('programId');
    });

    it('requires a reason of at least 10 characters', async () => {
      const { service } = build(supportAdmin());
      await expect(
        service.createImpersonation(actor, { ...dto, reason: 'short' } as never, 'ip', 'ua'),
      ).rejects.toThrow('Reason');
    });
  });

  describe('exchangeImpersonationToken (read_only ticket)', () => {
    const ticket = {
      id: 'ticket-1',
      adminId: 'admin-1',
      targetUserId: 'user-1',
      mode: 'read_only',
      revokedAt: null,
      consumedAt: null,
      sessionToken: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    function buildExchange() {
      const prisma = {
        supportAccessImpersonationTicket: {
          findUnique: jest.fn().mockResolvedValue(ticket),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'p@example.com',
            brandId: 'brand-1',
            isActive: true,
            deletedAt: null,
            isOnboardingCompleted: true,
          }),
          update: jest.fn(),
        },
        userSession: { upsert: jest.fn().mockReturnValue('upsert-op') },
        dataChangeLog: { create: jest.fn() },
        $transaction: jest.fn().mockResolvedValue([]),
      };
      const jwt = { sign: jest.fn().mockReturnValue('access.jwt') } as unknown as JwtService;
      const config = { get: jest.fn((_k: string, d?: string) => d) } as unknown as ConfigService;
      const service = new SupportAccessService(prisma as never, jwt, config, {} as never);
      return { service, prisma, jwt };
    }

    it('issues a 30 minute read_only access token and no refresh token', async () => {
      const { service, prisma, jwt } = buildExchange();
      const res = await service.exchangeImpersonationToken('tok', '1.1.1.1', 'ua');

      expect(res.accessToken).toBe('access.jwt');
      expect(res.refreshToken).toBeUndefined();
      expect(jwt.sign).toHaveBeenCalledTimes(1);

      const [claims, options] = (jwt.sign as jest.Mock).mock.calls[0];
      expect(claims).toMatchObject({
        sub: 'user-1',
        type: 'access',
        impersonatedByAdminId: 'admin-1',
        impersonationTicketId: 'ticket-1',
        impersonationMode: 'read_only',
      });
      expect(options.expiresIn).toBeGreaterThan(0);
      expect(options.expiresIn).toBeLessThanOrEqual(30 * 60);

      const sessionArgs = prisma.userSession.upsert.mock.calls[0][0];
      expect(sessionArgs.create.refreshToken).toBeNull();
      expect(sessionArgs.update.refreshToken).toBeNull();
      expect(sessionArgs.create.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000);
    });
  });
});
