// src/shared/guards/admin-permission.guard.spec.ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ADMIN_PERMISSION_KEY,
  AdminPermissionGuard,
  RequiresProgramPermissionMetadata,
  assertProgramPermission,
} from './admin-permission.guard';

const PROGRAM_ID = 'program-1';
const BRAND_ID = 'brand-1';

function admin(overrides: Record<string, unknown> = {}) {
  return {
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'admin', permissions: [] },
    adminBrands: [],
    adminPrograms: [],
    ...overrides,
  };
}

function buildPrisma(adminRow: unknown, programBrandId: string | null = BRAND_ID) {
  return {
    admin: { findUnique: jest.fn().mockResolvedValue(adminRow) },
    program: {
      findUnique: jest.fn().mockResolvedValue(programBrandId ? { brandId: programBrandId } : null),
    },
  };
}

const USER = { userId: 'user-1', email: 'a@example.com', brandId: BRAND_ID, adminId: 'admin-1' };

function check(adminRow: unknown, anyOf: string[] = ['program:write'], programBrandId: string | null = BRAND_ID) {
  return assertProgramPermission(buildPrisma(adminRow, programBrandId) as never, USER, PROGRAM_ID, anyOf);
}

describe('assertProgramPermission', () => {
  it('rejects a principal with no admin profile', async () => {
    const prisma = buildPrisma(admin());
    await expect(
      assertProgramPermission(prisma as never, { ...USER, adminId: undefined }, PROGRAM_ID, ['program:write']),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.admin.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when the admin row does not exist', async () => {
    await expect(check(null)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes when the role grants the permission', async () => {
    await expect(check(admin({ role: { name: 'admin', permissions: ['program:write'] } }))).resolves.toBeUndefined();
  });

  it('passes when a custom permission grants it, case-insensitively', async () => {
    await expect(check(admin({ customPermissions: ['Program:Write'] }))).resolves.toBeUndefined();
  });

  it('rejects a reviewer who holds review:write but not program:write', async () => {
    const reviewer = admin({
      role: { name: 'reviewer', permissions: ['program:read', 'review:read', 'review:write'] },
      adminPrograms: [{ programId: PROGRAM_ID, permissions: ['review:write'] }],
    });
    await expect(check(reviewer)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes on a grant attached to this program', async () => {
    const row = admin({ adminPrograms: [{ programId: PROGRAM_ID, permissions: ['program:write'] }] });
    await expect(check(row)).resolves.toBeUndefined();
  });

  it('does not borrow a grant attached to a different program', async () => {
    const row = admin({ adminPrograms: [{ programId: 'program-other', permissions: ['program:write'] }] });
    await expect(check(row)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("passes on a grant attached to this program's brand", async () => {
    const row = admin({ adminBrands: [{ brandId: BRAND_ID, permissions: ['program:write'] }] });
    await expect(check(row)).resolves.toBeUndefined();
  });

  it('does not borrow a grant attached to a different brand', async () => {
    const row = admin({ adminBrands: [{ brandId: 'brand-other', permissions: ['program:write'] }] });
    await expect(check(row)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('skips the program lookup when the admin has no brand grants', async () => {
    const prisma = buildPrisma(admin({ role: { name: 'admin', permissions: ['program:write'] } }));
    await assertProgramPermission(prisma as never, USER, PROGRAM_ID, ['program:write']);
    expect(prisma.program.findUnique).not.toHaveBeenCalled();
  });

  it.each(['*', 'platform.*', 'admin.*', 'platform.manage'])('passes on the grant-all permission %s', async (grant) => {
    await expect(check(admin({ customPermissions: [grant] }))).resolves.toBeUndefined();
  });

  it('passes for a super admin by role name even with no explicit permission', async () => {
    await expect(check(admin({ role: { name: 'Super Admin', permissions: [] } }))).resolves.toBeUndefined();
  });

  it('accepts any one of several required permissions', async () => {
    const row = admin({ customPermissions: ['content:write'] });
    await expect(check(row, ['program:write', 'content:write'])).resolves.toBeUndefined();
  });
});

describe('AdminPermissionGuard', () => {
  function buildContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  function buildGuard(metadata: RequiresProgramPermissionMetadata | undefined, prisma: unknown) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === ADMIN_PERMISSION_KEY ? metadata : undefined)),
    } as unknown as Reflector;
    return new AdminPermissionGuard(reflector, prisma as never);
  }

  it('lets undecorated routes through without a lookup', async () => {
    const prisma = buildPrisma(admin());
    const guard = buildGuard(undefined, prisma);
    await expect(guard.canActivate(buildContext({ user: USER, params: {} }))).resolves.toBe(true);
    expect(prisma.admin.findUnique).not.toHaveBeenCalled();
  });

  it('reads the program id from the named route param', async () => {
    const row = admin({ adminPrograms: [{ programId: PROGRAM_ID, permissions: ['program:write'] }] });
    const guard = buildGuard({ anyOf: ['program:write'], paramName: 'id' }, buildPrisma(row));
    await expect(guard.canActivate(buildContext({ user: USER, params: { id: PROGRAM_ID } }))).resolves.toBe(true);
  });

  it('throws Forbidden when the permission is missing', async () => {
    const guard = buildGuard({ anyOf: ['program:write'], paramName: 'programId' }, buildPrisma(admin()));
    await expect(
      guard.canActivate(buildContext({ user: USER, params: { programId: PROGRAM_ID } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
