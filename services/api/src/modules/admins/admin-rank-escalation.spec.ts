// services/api/src/modules/admins/admin-rank-escalation.spec.ts
//
// Rank rule for admin management. Personas are prod admins + admin_roles as of
// 2026-11-19: two Super Admins (999), one "Admin" (800, can_manage_admins,
// admin.manage), Project Manager (level 1 but admin.manage), scoped roles below.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AdminAccessControlService, AdminTargetAction } from './application/services/admin-access-control.service';
import { AdminsController } from './presentation/admins.controller';
import { AdminRolesController } from './presentation/admin-roles.controller';
import { CreateAdminDto } from './presentation/dto/create-admin.dto';

type Role = { id: string; name: string; permissions: string[] };

const ROLES = {
  superAdmin: {
    id: 'role-super',
    name: 'Super Admin',
    permissions: ['*', 'admin.*', 'platform.*', 'platform.manage', 'platform_access', 'admin.manage'],
  },
  admin: { id: 'role-admin', name: 'Admin', permissions: ['platform_access', 'brand.manage', 'program:read'] },
  projectManager: {
    id: 'role-pm',
    name: 'Project Manager',
    permissions: ['platform_access', 'platform.manage', 'brand.manage', 'admin.manage'],
  },
  digitalMarketing: { id: 'role-dm', name: 'Digital Marketing', permissions: ['participants:read'] },
  programAdmin: { id: 'role-program-admin', name: 'Program Admin', permissions: ['program:read', 'applications:read'] },
  wildcard: { id: 'role-wildcard', name: 'Ops', permissions: ['*'] },
} satisfies Record<string, Role>;

function persona(id: string, accessLevel: number, role: Role | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    roleId: role?.id ?? null,
    accessLevel,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [] as string[],
    role,
    adminBrands: [] as Array<{ permissions: string[] }>,
    adminPrograms: [] as Array<{ permissions: string[] }>,
    user: { id: `user-${id}`, isActive: true },
    deletedAt: null,
    ...extra,
  };
}

const ADMINS = {
  superA: persona('super-a', 999, ROLES.superAdmin, { canManageAdmins: true, canAssignRoles: true, customPermissions: ['*'] }),
  superB: persona('super-b', 999, ROLES.superAdmin, { canManageAdmins: true, canAssignRoles: true }),
  admin: persona('admin', 800, ROLES.admin, {
    canManageAdmins: true,
    canAssignRoles: true,
    customPermissions: ['brand.manage', 'admin.manage', 'program:read'],
  }),
  projectManager: persona('pm', 1, ROLES.projectManager),
  digitalMarketing: persona('dm', 1, ROLES.digitalMarketing),
  programAdmin: persona('program-admin', 3, ROLES.programAdmin),
};

type AdminPersona = keyof typeof ADMINS;

function actingAs(name: AdminPersona): CurrentUserData {
  return { userId: `user-${ADMINS[name].id}`, email: `${name}@test.local`, brandId: 'brand-1', adminId: ADMINS[name].id };
}

/** A PrismaService stand-in that answers the reads the rank checks make. */
function buildRankPrisma() {
  const all = Object.values(ADMINS);
  const byId = (id: string) => all.find((admin) => admin.id === id) ?? null;

  const prisma = {
    admin: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(byId(where.id))),
      findFirst: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(byId(where.id))),
      findMany: jest.fn(({ where }: { where: { roleId: string } }) =>
        Promise.resolve(all.filter((admin) => admin.roleId === where.roleId)),
      ),
    },
    adminRole: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(Object.values(ROLES).find((role) => role.id === where.id) ?? null),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
  };

  return { prisma, asService: prisma as unknown as PrismaService };
}

const MUTATIONS: AdminTargetAction[] = ['update', 'reset-password', 'delete', 'restore'];

describe('AdminAccessControlService rank rule', () => {
  let service: AdminAccessControlService;
  let prisma: ReturnType<typeof buildRankPrisma>['prisma'];

  beforeEach(() => {
    const built = buildRankPrisma();
    prisma = built.prisma;
    service = new AdminAccessControlService(built.asService);
  });

  describe('Admin (800) against a Super Admin', () => {
    it.each(MUTATIONS)('refuses %s', async (action) => {
      await expect(
        service.assertCanManageAdmin(actingAs('admin'), ADMINS.superA.id, action),
      ).rejects.toThrow(new ForbiddenException('You cannot manage an administrator at or above your own rank.'));
    });
  });

  describe('Admin (800) granting', () => {
    it('cannot create an admin with the Super Admin role', async () => {
      await expect(service.assertCanCreateAdmin(actingAs('admin'), ROLES.superAdmin.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('cannot create an admin with a role carrying "*"', async () => {
      await expect(service.assertCanCreateAdmin(actingAs('admin'), ROLES.wildcard.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('cannot promote a lower admin to the Super Admin role', async () => {
      await expect(
        service.assertCanManageAdmin(actingAs('admin'), ADMINS.programAdmin.id, 'update', {
          roleId: ROLES.superAdmin.id,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cannot hand out a privileged permission it does not hold (roles.manage, platform.manage)', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('admin'), null, { name: 'Ops', permissions: ['roles.manage'] }),
      ).rejects.toThrow('You cannot grant permissions you do not hold: roles.manage.');
      await expect(service.assertCanCreateAdmin(actingAs('admin'), ROLES.projectManager.id)).rejects.toThrow(
        /cannot grant permissions you do not hold: .*platform\.manage/,
      );
    });

    it('may still create roles with functional permissions it does not hold itself', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('admin'), null, { name: 'Reviewer', permissions: ['review:read', 'documents:read'] }),
      ).resolves.toBeUndefined();
    });

    it('can create an ordinary admin', async () => {
      await expect(service.assertCanCreateAdmin(actingAs('admin'), ROLES.programAdmin.id)).resolves.toBeUndefined();
    });
  });

  describe('Admin (800) against a lower admin (Program Admin, level 3)', () => {
    it.each(MUTATIONS)('allows %s', async (action) => {
      await expect(
        service.assertCanManageAdmin(actingAs('admin'), ADMINS.programAdmin.id, action, {
          roleId: ROLES.digitalMarketing.id,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('self', () => {
    it('cannot change own role (the only way to raise own rank through this API)', async () => {
      await expect(
        service.assertCanManageAdmin(actingAs('admin'), ADMINS.admin.id, 'update', { roleId: ROLES.superAdmin.id }),
      ).rejects.toThrow('You cannot change your own role.');
    });

    it('cannot deactivate self', async () => {
      await expect(
        service.assertCanManageAdmin(actingAs('admin'), ADMINS.admin.id, 'update', { isActive: false }),
      ).rejects.toThrow('You cannot change your own account status.');
    });

    it('cannot delete self, even as a super admin', async () => {
      await expect(service.assertCanManageAdmin(actingAs('superA'), ADMINS.superA.id, 'delete')).rejects.toThrow(
        'You cannot delete your own administrator account.',
      );
    });

    // The dashboard edit form always resends the current roleId and isActive.
    it('can save own profile when role and status are resent unchanged', async () => {
      await expect(
        service.assertCanManageAdmin(actingAs('admin'), ADMINS.admin.id, 'update', {
          roleId: ROLES.admin.id,
          isActive: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('Super Admin', () => {
    it.each(MUTATIONS)('may %s another Super Admin', async (action) => {
      await expect(service.assertCanManageAdmin(actingAs('superA'), ADMINS.superB.id, action)).resolves.toBeUndefined();
    });

    it.each(['admin', 'projectManager', 'programAdmin'] as const)('may manage %s', async (target) => {
      await expect(
        service.assertCanManageAdmin(actingAs('superB'), ADMINS[target].id, 'update', { roleId: ROLES.superAdmin.id }),
      ).resolves.toBeUndefined();
    });

    it('may create a Super Admin', async () => {
      await expect(service.assertCanCreateAdmin(actingAs('superB'), ROLES.superAdmin.id)).resolves.toBeUndefined();
    });
  });

  describe('Project Manager (level 1, admin.manage)', () => {
    it('cannot reset the Admin (800) password', async () => {
      await expect(
        service.assertCanManageAdmin(actingAs('projectManager'), ADMINS.admin.id, 'reset-password'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cannot manage a peer at the same level', async () => {
      await expect(
        service.assertCanManageAdmin(actingAs('projectManager'), ADMINS.digitalMarketing.id, 'delete'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cannot create admins, since a new admin starts at level 1', async () => {
      await expect(service.assertCanCreateAdmin(actingAs('projectManager'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  it('404s an unknown target instead of letting it through', async () => {
    await expect(service.assertCanManageAdmin(actingAs('admin'), 'missing', 'delete')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reads deleted rows only for restore', async () => {
    await service.assertCanManageAdmin(actingAs('superA'), ADMINS.programAdmin.id, 'restore');
    await service.assertCanManageAdmin(actingAs('superA'), ADMINS.programAdmin.id, 'delete');

    expect(prisma.admin.findFirst.mock.calls[0][0].where).toEqual({
      id: ADMINS.programAdmin.id,
      deletedAt: { not: null },
    });
    expect(prisma.admin.findFirst.mock.calls[1][0].where).toEqual({ id: ADMINS.programAdmin.id });
  });

  describe('role writes', () => {
    it('Admin cannot edit the Super Admin role', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('admin'), ROLES.superAdmin, { name: 'Super Admin', permissions: [] }),
      ).rejects.toThrow('Only a super admin can create or change a super-admin role.');
    });

    it('Admin cannot create a role with "*"', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('admin'), null, { name: 'Ops', permissions: ['*'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Admin cannot rename a role to Owner', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('admin'), ROLES.programAdmin, { name: 'Owner', permissions: [] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Admin cannot edit own role', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('admin'), ROLES.admin, { name: 'Admin', permissions: ['payments:write'] }),
      ).rejects.toThrow(/held by an administrator at or above your own rank/);
    });

    it('Project Manager cannot edit the role held by the Admin (800)', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('projectManager'), ROLES.admin, { name: 'Admin', permissions: [] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Admin can edit a role held only by lower admins', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('admin'), ROLES.programAdmin, {
          name: 'Program Admin',
          permissions: ['program:read', 'program:write'],
        }),
      ).resolves.toBeUndefined();
    });

    it('Super Admin can edit the Super Admin role', async () => {
      await expect(
        service.assertCanWriteRole(actingAs('superA'), ROLES.superAdmin, { name: 'Super Admin', permissions: ['*'] }),
      ).resolves.toBeUndefined();
    });
  });
});

// The service is only as good as its call sites: drive the real controllers so a
// route that forgets the check fails here, and prove nothing is written first.
describe('admin controllers enforce the rank rule before writing', () => {
  let prisma: ReturnType<typeof buildRankPrisma>['prisma'];
  let handlers: Record<'create' | 'update' | 'delete' | 'restore', { execute: jest.Mock }>;
  let admins: AdminsController;
  let roles: AdminRolesController;

  beforeEach(() => {
    const built = buildRankPrisma();
    prisma = built.prisma;
    const access = new AdminAccessControlService(built.asService);
    const handler = () => ({ execute: jest.fn().mockResolvedValue({ success: true }) });
    handlers = { create: handler(), update: handler(), delete: handler(), restore: handler() };
    const unused = {} as never;
    admins = new AdminsController(
      handlers.create as never,
      unused,
      unused,
      handlers.update as never,
      handlers.delete as never,
      handlers.restore as never,
      unused,
      access,
      built.asService,
    );
    roles = new AdminRolesController(built.asService, access);
  });

  const superId = ADMINS.superA.id;
  const asAdmin = actingAs('admin');

  it('Admin cannot reset a Super Admin password', async () => {
    await expect(admins.resetPassword(superId, { password: 'hunter2hunter2' }, asAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('Admin cannot update, delete or restore a Super Admin', async () => {
    await expect(admins.update(superId, { fullName: 'x' }, asAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(admins.remove(superId, asAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(admins.restore(superId, asAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    expect(handlers.update.execute).not.toHaveBeenCalled();
    expect(handlers.delete.execute).not.toHaveBeenCalled();
    expect(handlers.restore.execute).not.toHaveBeenCalled();
  });

  it('Admin cannot create an admin with the Super Admin role', async () => {
    const dto = { email: 'new@test.local', fullName: 'New', password: 'hunter2hunter2', roleId: ROLES.superAdmin.id };
    await expect(admins.create(dto as CreateAdminDto, asAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    expect(handlers.create.execute).not.toHaveBeenCalled();
  });

  it('Admin can reset a lower admin password', async () => {
    await admins.resetPassword(ADMINS.programAdmin.id, { password: 'hunter2hunter2' }, asAdmin);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: `user-${ADMINS.programAdmin.id}` } }),
    );
  });

  it('Super Admin can reset another Super Admin password', async () => {
    await admins.resetPassword(ADMINS.superB.id, { password: 'hunter2hunter2' }, actingAs('superA'));
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('Admin cannot edit the Super Admin role or mint a "*" role', async () => {
    await expect(roles.updateRole(asAdmin, ROLES.superAdmin.id, { permissions: [] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(roles.createRole(asAdmin, { name: 'Ops2', permissions: ['*'] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.adminRole.update).not.toHaveBeenCalled();
  });
});
