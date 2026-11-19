// services/api/src/modules/admins/application/services/admin-invite.service.spec.ts
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminInviteService } from './admin-invite.service';

const ROLE_ID = '33333333-3333-4333-8333-333333333333';
const PROGRAM_A = '11111111-1111-4111-8111-111111111111';
const actor = { userId: 'u0', email: 'boss@ybb.org', brandId: 'b', adminId: 'admin-0' };
const params = { email: 'rani@example.com', fullName: 'Rani', roleId: ROLE_ID, programIds: [PROGRAM_A] };

function build() {
  const prisma = {
    program: { findMany: jest.fn().mockResolvedValue([{ id: PROGRAM_A, brandId: 'brand-1' }]) },
    brand: { findFirst: jest.fn().mockResolvedValue({ id: 'brand-default' }), findUnique: jest.fn().mockResolvedValue({ name: 'IYS' }) },
    adminRole: { findFirst: jest.fn().mockResolvedValue({ id: ROLE_ID, name: 'Reviewer' }) },
    user: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
  };
  const access = { assertCanCreateAdmin: jest.fn().mockResolvedValue(undefined) };
  const createAdmin = { execute: jest.fn().mockResolvedValue({ id: 'new-admin', userId: 'new-user' }) };
  const links = { issue: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminInviteService(prisma as never, access as never, createAdmin as never, links as never);
  return { prisma, access, createAdmin, links, service };
}

describe('AdminInviteService.invite', () => {
  it('creates the admin with a NULL password and issues an invite link', async () => {
    const { service, createAdmin, links } = build();

    await expect(service.invite(actor, params)).resolves.toEqual({
      adminId: 'new-admin', roleId: ROLE_ID, programIds: [PROGRAM_A], emailSent: true,
    });

    expect(createAdmin.execute.mock.calls[0][0]).toMatchObject({
      email: 'rani@example.com', fullName: 'Rani', password: null, createdBy: 'admin-0', roleId: ROLE_ID,
      programIds: [PROGRAM_A], brandIds: [], homeBrandId: 'brand-1', existingUserId: undefined,
    });
    expect(links.issue).toHaveBeenCalledWith({
      userId: 'new-user', email: 'rani@example.com', fullName: 'Rani', kind: 'invite', roleName: 'Reviewer',
    });
  });

  it('attaches to the live participant user in the home brand', async () => {
    const { prisma, service, createAdmin } = build();
    prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'participant-user', isActive: true });

    await service.invite(actor, params);

    expect(createAdmin.execute.mock.calls[0][0]).toMatchObject({ homeBrandId: 'brand-1', existingUserId: 'participant-user', password: null });
  });

  it('409s, same wording as approve, when the email already belongs to an admin', async () => {
    const { prisma, service, createAdmin, links } = build();
    prisma.user.findFirst.mockResolvedValue({ admin: { id: 'admin-9' } });

    await expect(service.invite(actor, params)).rejects.toThrow(
      new ConflictException('This email already belongs to an admin. Use "Send password link" instead.'),
    );
    expect(createAdmin.execute).not.toHaveBeenCalled();
    expect(links.issue).not.toHaveBeenCalled();
  });

  it('409s when the participant account in the target brand is deactivated', async () => {
    const { prisma, service, createAdmin } = build();
    prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'p', isActive: false });

    await expect(service.invite(actor, params)).rejects.toThrow(/account in IYS is deactivated; reactivate it first/);
    expect(createAdmin.execute).not.toHaveBeenCalled();
  });

  it('propagates the rank / grant-ceiling refusal and creates nothing', async () => {
    const { access, service, createAdmin, links } = build();
    access.assertCanCreateAdmin.mockRejectedValue(new ForbiddenException('rank'));

    await expect(service.invite(actor, params)).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertCanCreateAdmin).toHaveBeenCalledWith(actor, ROLE_ID);
    expect(createAdmin.execute).not.toHaveBeenCalled();
    expect(links.issue).not.toHaveBeenCalled();
  });

  it('400s on an unknown role or unknown/inactive programs', async () => {
    const a = build();
    a.prisma.adminRole.findFirst.mockResolvedValue(null);
    await expect(a.service.invite(actor, params)).rejects.toBeInstanceOf(BadRequestException);

    const b = build();
    b.prisma.program.findMany.mockResolvedValue([]);
    await expect(b.service.invite(actor, params)).rejects.toBeInstanceOf(BadRequestException);
    expect(b.createAdmin.execute).not.toHaveBeenCalled();
  });

  it('401s without an admin id', async () => {
    const { service } = build();
    await expect(service.invite({ ...actor, adminId: undefined }, params)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('reports emailSent false, without throwing, when the invite emit fails', async () => {
    const { service, links } = build();
    links.issue.mockRejectedValue(new Error('broker down'));

    await expect(service.invite(actor, params)).resolves.toMatchObject({ adminId: 'new-admin', emailSent: false });
  });

  it('with no programs, targets the default brand', async () => {
    const { prisma, service, createAdmin } = build();
    prisma.program.findMany.mockResolvedValue([]);

    await service.invite(actor, { ...params, programIds: [] });

    expect(createAdmin.execute.mock.calls[0][0]).toMatchObject({ homeBrandId: 'brand-default', programIds: [] });
  });
});

describe('AdminInviteService.check', () => {
  it('reports no admin and no participant brands for an unknown email', async () => {
    const { service } = build();
    await expect(service.check('Nobody@Example.com')).resolves.toEqual({ existingAdminId: null, participantBrands: [] });
  });

  it('returns the admin id and the distinct, sorted participant brand names', async () => {
    const { prisma, service } = build();
    prisma.user.findMany.mockResolvedValue([
      { admin: { id: 'admin-9' }, brand: { name: 'MEYS' } },
      { admin: null, brand: { name: 'KYS' } },
      { admin: null, brand: { name: 'IYS' } },
      { admin: null, brand: { name: 'KYS' } },
    ]);

    await expect(service.check(' Rani@Example.com ')).resolves.toEqual({ existingAdminId: 'admin-9', participantBrands: ['IYS', 'KYS'] });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: 'rani@example.com', mode: 'insensitive' }, deletedAt: null } }),
    );
  });
});
