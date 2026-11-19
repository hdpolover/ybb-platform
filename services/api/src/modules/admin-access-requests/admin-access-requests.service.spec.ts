// services/api/src/modules/admin-access-requests/admin-access-requests.service.spec.ts
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminAccessRequestsService } from './admin-access-requests.service';

const PROGRAM_A = '11111111-1111-4111-8111-111111111111';
const PROGRAM_B = '22222222-2222-4222-8222-222222222222';
const ROLE_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const actor = { userId: 'u0', email: 'boss@ybb.org', brandId: 'b', adminId: 'admin-0' };

function build() {
  const prisma = {
    program: { findMany: jest.fn().mockResolvedValue([]) },
    brand: { findFirst: jest.fn().mockResolvedValue({ id: 'brand-default' }), findUnique: jest.fn().mockResolvedValue({ name: 'IYS' }) },
    adminRole: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    user: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), update: jest.fn((a) => a) },
    admin: { findMany: jest.fn().mockResolvedValue([]) },
    adminAccessRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn((a) => a),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(3),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const access = {
    assertCanManageAdmins: jest.fn().mockResolvedValue(undefined),
    assertCanCreateAdmin: jest.fn().mockResolvedValue(undefined),
  };
  const createAdmin = { execute: jest.fn().mockResolvedValue({ id: 'new-admin', userId: 'new-user' }) };
  const links = { issue: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminAccessRequestsService(prisma as never, access as never, createAdmin as never, links as never);
  return { prisma, access, createAdmin, links, service };
}

describe('AdminAccessRequestsService.submit', () => {
  const dto = (over = {}) => ({
    fullName: 'Rani', email: 'Rani@Example.com', division: 'reviewer', programIds: [PROGRAM_A, PROGRAM_B], ...over,
  });

  it('lowercases the email, drops unknown or inactive programs and stores ip/user-agent', async () => {
    const { prisma, service } = build();
    prisma.program.findMany.mockResolvedValue([{ id: PROGRAM_A }]);

    await expect(service.submit(dto() as never, '1.2.3.4', 'jest')).resolves.toBeUndefined();

    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true, deletedAt: null }) }),
    );
    expect(prisma.adminAccessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'rani@example.com', requestedProgramIds: [PROGRAM_A], ip: '1.2.3.4', userAgent: 'jest', status: 'pending',
      }),
    });
  });

  it('updates the pending request for the same email instead of inserting a duplicate', async () => {
    const { prisma, service } = build();
    prisma.adminAccessRequest.findFirst.mockResolvedValue({ id: REQUEST_ID });

    await service.submit(dto({ note: 'new note' }) as never, '1.2.3.4', 'jest');

    expect(prisma.adminAccessRequest.findFirst).toHaveBeenCalledWith({ where: { email: 'rani@example.com', status: 'pending' }, select: { id: true } });
    expect(prisma.adminAccessRequest.create).not.toHaveBeenCalled();
    expect(prisma.adminAccessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: REQUEST_ID }, data: expect.objectContaining({ note: 'new note' }) }),
    );
  });

  it('does not reveal an existing admin: never queries users', async () => {
    const { prisma, service } = build();
    await service.submit(dto() as never, '1.2.3.4', 'jest');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('treats a concurrent duplicate pending insert (P2002) as success', async () => {
    const { prisma, service } = build();
    prisma.adminAccessRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.submit(dto() as never, '1.2.3.4', 'jest')).resolves.toBeUndefined();
  });

  it('rethrows other database errors', async () => {
    const { prisma, service } = build();
    prisma.adminAccessRequest.create.mockRejectedValue(new Error('boom'));
    await expect(service.submit(dto() as never, '1.2.3.4', 'jest')).rejects.toThrow('boom');
  });
});

describe('AdminAccessRequestsService.getOptions', () => {
  it('returns divisions and active programs sorted by brand then name', async () => {
    const { prisma, service } = build();
    prisma.program.findMany.mockResolvedValue([{ id: PROGRAM_A, name: 'IYS 2027', brand: { name: 'IYS' } }]);

    const result = await service.getOptions();

    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
      }),
    );
    expect(result.programs).toEqual([{ id: PROGRAM_A, name: 'IYS 2027', brandName: 'IYS' }]);
    expect(result.divisions).toContainEqual({ key: 'reviewer', label: 'Reviewer / Mentoring' });
    expect(result.divisions[0]).not.toHaveProperty('defaultRoleName');
  });
});

describe('AdminAccessRequestsService.list', () => {
  it('maps default role, programs, reviewer and the existing admin', async () => {
    const { prisma, service } = build();
    prisma.adminAccessRequest.findMany.mockResolvedValue([
      {
        id: REQUEST_ID, fullName: 'Rani', email: 'rani@example.com', whatsapp: null, division: 'admin',
        requestedProgramIds: [PROGRAM_A, PROGRAM_B], note: null, status: 'approved', createdAt: new Date('2026-11-19'),
        reviewedAt: new Date('2026-11-20'), reviewedByAdminId: 'admin-0', rejectReason: null,
      },
    ]);
    prisma.adminRole.findMany.mockResolvedValue([
      { id: 'r-pa', name: 'Program Admin', permissions: ['program:read'] },
    ]);
    prisma.program.findMany.mockResolvedValue([{ id: PROGRAM_A, name: 'IYS 2027', brand: { name: 'IYS' } }]);
    prisma.admin.findMany.mockResolvedValue([{ id: 'admin-0', fullName: 'Boss' }]);
    prisma.user.findMany.mockResolvedValue([{ email: 'Rani@Example.com', admin: { id: 'admin-9' } }]);

    const [item] = (await service.list('approved')).data;

    expect(prisma.adminAccessRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'approved' }, orderBy: { createdAt: 'desc' } }),
    );
    expect(item).toEqual({
      id: REQUEST_ID, fullName: 'Rani', email: 'rani@example.com', whatsapp: null, division: 'admin',
      divisionLabel: 'Admin / Program Operations', defaultRoleId: 'r-pa', defaultRoleName: 'Program Admin',
      requestedPrograms: [{ id: PROGRAM_A, name: 'IYS 2027', brandName: 'IYS' }], note: null, status: 'approved',
      createdAt: new Date('2026-11-19'), reviewedAt: new Date('2026-11-20'), reviewedByName: 'Boss',
      rejectReason: null, existingAdminId: 'admin-9',
    });
  });

  it('gives no default when the named role is platform tier or missing', async () => {
    const { prisma, service } = build();
    prisma.adminAccessRequest.findMany.mockResolvedValue([
      { id: 'a', fullName: 'A', email: 'a@x.co', division: 'admin', requestedProgramIds: [], status: 'pending', createdAt: new Date() },
      { id: 'b', fullName: 'B', email: 'b@x.co', division: 'other', requestedProgramIds: [], status: 'pending', createdAt: new Date() },
    ]);
    // someone made "Program Admin" a platform role: it must not be offered.
    prisma.adminRole.findMany.mockResolvedValue([{ id: 'r', name: 'Program Admin', permissions: ['platform_access'] }]);

    const items = (await service.list('pending')).data;

    expect(items.map((i) => [i.defaultRoleId, i.defaultRoleName])).toEqual([[null, null], [null, null]]);
  });
});

describe('AdminAccessRequestsService.approve', () => {
  const dto = { roleId: ROLE_ID, programIds: [PROGRAM_A] };
  const pending = { id: REQUEST_ID, fullName: 'Rani', email: 'rani@example.com', status: 'pending' };

  function ready() {
    const ctx = build();
    ctx.prisma.adminAccessRequest.findUnique.mockResolvedValue(pending);
    ctx.prisma.program.findMany.mockResolvedValue([{ id: PROGRAM_A, brandId: 'brand-1' }]);
    ctx.prisma.adminRole.findFirst.mockResolvedValue({ id: ROLE_ID, name: 'Reviewer' });
    return ctx;
  }

  it.each([
    ['missing', null],
    ['already reviewed', { ...pending, status: 'approved' }],
  ])('409s when the request is %s', async (_label, row) => {
    const { prisma, service, createAdmin } = ready();
    prisma.adminAccessRequest.findUnique.mockResolvedValue(row);
    await expect(service.approve(actor, REQUEST_ID, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(createAdmin.execute).not.toHaveBeenCalled();
  });

  it('409s, pointing at "Send password link", when the email already belongs to an admin', async () => {
    const { prisma, service, createAdmin } = ready();
    prisma.user.findFirst.mockResolvedValue({ id: 'u9', admin: { id: 'admin-9' } });
    await expect(service.approve(actor, REQUEST_ID, dto)).rejects.toThrow(/Send password link/);
    expect(createAdmin.execute).not.toHaveBeenCalled();
  });

  it('propagates the rank / grant-ceiling refusal and creates nothing', async () => {
    const { access, service, createAdmin, links } = ready();
    access.assertCanCreateAdmin.mockRejectedValue(new ForbiddenException('rank'));
    await expect(service.approve(actor, REQUEST_ID, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertCanCreateAdmin).toHaveBeenCalledWith(actor, ROLE_ID);
    expect(createAdmin.execute).not.toHaveBeenCalled();
    expect(links.issue).not.toHaveBeenCalled();
  });

  it('requires admin.manage', async () => {
    const { access, service, createAdmin } = ready();
    access.assertCanManageAdmins.mockRejectedValue(new ForbiddenException('no'));
    await expect(service.approve(actor, REQUEST_ID, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(createAdmin.execute).not.toHaveBeenCalled();
  });

  it('rejects unknown or inactive programs', async () => {
    const { prisma, service, createAdmin } = ready();
    prisma.program.findMany.mockResolvedValue([]);
    await expect(service.approve(actor, REQUEST_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true, deletedAt: null }) }),
    );
    expect(createAdmin.execute).not.toHaveBeenCalled();
  });

  it('creates the admin with its programs, marks the request, and issues an invite link', async () => {
    const { prisma, service, createAdmin, links } = ready();

    await expect(service.approve(actor, REQUEST_ID, dto)).resolves.toEqual({ adminId: 'new-admin' });

    const command = createAdmin.execute.mock.calls[0][0];
    expect(command).toMatchObject({
      email: 'rani@example.com', fullName: 'Rani', createdBy: 'admin-0', roleId: ROLE_ID, programIds: [PROGRAM_A],
      brandIds: [], homeBrandId: 'brand-1', existingUserId: undefined,
    });
    // never a password anyone knows
    expect(command.password.length).toBeGreaterThanOrEqual(32);
    expect(prisma.adminAccessRequest.update).toHaveBeenCalledWith({
      where: { id: REQUEST_ID },
      data: expect.objectContaining({
        status: 'approved', reviewedByAdminId: 'admin-0', createdAdminId: 'new-admin', reviewedAt: expect.any(Date),
      }),
    });
    expect(links.issue).toHaveBeenCalledWith({
      userId: 'new-user', email: 'rani@example.com', fullName: 'Rani', kind: 'invite', roleName: 'Reviewer',
      invalidateCredentials: true,
    });
  });

  it('attaches to the participant user already in the first program brand instead of creating one', async () => {
    const { prisma, service, createAdmin, links } = ready();
    // 1st lookup: no admin owns the email; 2nd: the live participant row in brand-1
    prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'participant-user', isActive: true });

    await service.approve(actor, REQUEST_ID, dto);

    expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { email: { equals: 'rani@example.com', mode: 'insensitive' }, brandId: 'brand-1' },
    }));
    expect(createAdmin.execute.mock.calls[0][0]).toMatchObject({ homeBrandId: 'brand-1', existingUserId: 'participant-user' });
    expect(links.issue).toHaveBeenCalledWith(expect.objectContaining({ invalidateCredentials: true }));
  });

  it('409s when the user in the target brand is deactivated', async () => {
    const { prisma, service, createAdmin, links } = ready();
    prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'participant-user', isActive: false });

    await expect(service.approve(actor, REQUEST_ID, dto)).rejects.toThrow(/account in IYS is deactivated; reactivate it first/);
    expect(createAdmin.execute).not.toHaveBeenCalled();
    expect(links.issue).not.toHaveBeenCalled();
  });

  it('409s when the user in the target brand is soft-deleted', async () => {
    const { prisma, service, createAdmin } = ready();
    prisma.user.findFirst
      .mockResolvedValueOnce(null) // no admin owns the email
      .mockResolvedValueOnce(null) // no live row
      .mockResolvedValueOnce({ id: 'gone' }); // deleted row

    await expect(service.approve(actor, REQUEST_ID, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(createAdmin.execute).not.toHaveBeenCalled();
  });

  it('with no programs, targets the default brand', async () => {
    const { prisma, service, createAdmin } = ready();
    prisma.program.findMany.mockResolvedValue([]);

    await service.approve(actor, REQUEST_ID, { roleId: ROLE_ID, programIds: [] });

    expect(createAdmin.execute.mock.calls[0][0]).toMatchObject({ homeBrandId: 'brand-default', programIds: [] });
  });
});

describe('AdminAccessRequestsService.reject', () => {
  it('marks a pending request rejected and sends no mail', async () => {
    const { prisma, service, links } = build();
    await expect(service.reject(actor, REQUEST_ID, ' not on the team ')).resolves.toEqual({ ok: true });
    expect(prisma.adminAccessRequest.updateMany).toHaveBeenCalledWith({
      where: { id: REQUEST_ID, status: 'pending' },
      data: expect.objectContaining({ status: 'rejected', reviewedByAdminId: 'admin-0', rejectReason: 'not on the team' }),
    });
    expect(links.issue).not.toHaveBeenCalled();
  });

  it('409s when nothing pending matched', async () => {
    const { prisma, service } = build();
    prisma.adminAccessRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reject(actor, REQUEST_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires admin.manage', async () => {
    const { access, prisma, service } = build();
    access.assertCanManageAdmins.mockRejectedValue(new ForbiddenException('no'));
    await expect(service.reject(actor, REQUEST_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.adminAccessRequest.updateMany).not.toHaveBeenCalled();
  });
});

describe('AdminAccessRequestsService.pendingCount', () => {
  it('counts pending requests', async () => {
    const { prisma, service } = build();
    await expect(service.pendingCount()).resolves.toEqual({ count: 3 });
    expect(prisma.adminAccessRequest.count).toHaveBeenCalledWith({ where: { status: 'pending' } });
  });
});
