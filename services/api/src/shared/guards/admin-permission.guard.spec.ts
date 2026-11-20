// src/shared/guards/admin-permission.guard.spec.ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ADMIN_PERMISSION_KEY,
  AdminPermissionGuard,
  RequiresProgramPermissionMetadata,
  assertBrandPermission,
  assertProgramPermission,
  programIdsWithPermission,
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

  it('rejects a missing program id without querying', async () => {
    const prisma = buildPrisma(admin({ role: { name: 'admin', permissions: ['program:write'] } }));
    await expect(
      assertProgramPermission(prisma as never, USER, undefined as unknown as string, ['program:write']),
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

  // Brand rows grant nothing (owner policy 2026-11-19), even on this program's own brand.
  it("does not count a grant attached to this program's brand", async () => {
    const row = admin({ adminBrands: [{ brandId: BRAND_ID, permissions: ['program:write'] }] });
    await expect(check(row)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes on a grant attached to this program', async () => {
    const row = admin({ adminPrograms: [{ programId: PROGRAM_ID, permissions: ['program:write'] }] });
    await expect(check(row)).resolves.toBeUndefined();
  });

  it('never looks up the program, so no brand can be consulted', async () => {
    const prisma = buildPrisma(admin({ adminBrands: [{ brandId: BRAND_ID, permissions: ['program:write'] }] }));
    await expect(assertProgramPermission(prisma as never, USER, PROGRAM_ID, ['program:write'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.program.findUnique).not.toHaveBeenCalled();
  });

  it.each(['*', 'platform.*', 'admin.*', 'platform.manage'])('passes on the grant-all permission %s', async (grant) => {
    await expect(check(admin({ customPermissions: [grant] }))).resolves.toBeUndefined();
  });

  it('passes for a super admin by role name even with no explicit permission', async () => {
    await expect(check(admin({ role: { name: 'Super Admin', permissions: [] } }))).resolves.toBeUndefined();
  });

  // The prod "Admin" role carries platform_access but none of the grant-all
  // permissions; platform-tier admins must not be narrowed by permission checks.
  it.each([
    ['platform_access', admin({ role: { name: 'Admin', permissions: ['platform_access'] } })],
    ['admin.manage', admin({ customPermissions: ['admin.manage'] })],
    ['access level 5', admin({ accessLevel: 5 })],
  ])('passes a platform-tier admin (%s) that lacks the permission', async (_label, row) => {
    await expect(check(row, ['review:write'])).resolves.toBeUndefined();
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

describe('assertBrandPermission', () => {
  const DOCUMENTS = ['documents:write', 'content:write', 'program:write'];
  // programs.findMany answers with the ids of the granted programs that sit in BRAND_ID.
  function checkBrand(adminRow: unknown, programsInBrand: string[] = [], user: { adminId?: string } = USER) {
    const prisma = {
      admin: { findUnique: jest.fn().mockResolvedValue(adminRow) },
      program: { findMany: jest.fn().mockResolvedValue(programsInBrand.map((id) => ({ id }))) },
    };
    return { prisma, result: assertBrandPermission(prisma as never, user, BRAND_ID, DOCUMENTS) };
  }

  it('rejects a principal with no admin profile without querying', async () => {
    const { prisma, result } = checkBrand(admin(), [], { adminId: undefined });
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.admin.findUnique).not.toHaveBeenCalled();
  });

  it('lets the platform tier through without the permission', async () => {
    await expect(checkBrand(admin({ accessLevel: 5 })).result).resolves.toBeUndefined();
  });

  it('passes on a role permission', async () => {
    await expect(checkBrand(admin({ role: { name: 'admin', permissions: ['documents:write'] } })).result).resolves.toBeUndefined();
  });

  // Brand rows grant nothing (owner policy 2026-11-19): only a program grant in the brand counts.
  it('does not count a grant on the brand row itself', async () => {
    const row = admin({ adminBrands: [{ brandId: BRAND_ID, permissions: ['content:write'] }] });
    await expect(checkBrand(row).result).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes on a grant on a program in this brand, refuses one on a program elsewhere', async () => {
    const row = admin({ adminPrograms: [{ programId: 'p-in', permissions: ['program:write'] }] });
    await expect(checkBrand(row, ['p-in']).result).resolves.toBeUndefined();
    await expect(checkBrand(row, []).result).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses an in-scope admin holding only unrelated permissions (Reviewer)', async () => {
    const row = admin({
      role: { name: 'Reviewer', permissions: ['applications:write', 'review:write'] },
      adminPrograms: [{ programId: 'p-in', permissions: [] }],
    });
    await expect(checkBrand(row, ['p-in']).result).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('programIdsWithPermission', () => {
  const ids = ['program-1', 'program-2', 'program-3'];
  const run = (adminRow: unknown, anyOf = ['payments:read', 'payments:write']) =>
    programIdsWithPermission(buildPrisma(adminRow) as never, USER, ids, anyOf);

  it('returns nothing for a principal with no admin profile', async () => {
    await expect(programIdsWithPermission(buildPrisma(null) as never, { userId: 'u' } as never, ids, ['a'])).resolves.toEqual([]);
  });

  it('returns every program for the platform tier', async () => {
    await expect(run(admin({ accessLevel: 10 }))).resolves.toEqual(ids);
  });

  it('returns every program when a role or custom permission grants it', async () => {
    await expect(run(admin({ role: { name: 'Finance', permissions: ['payments:read'] } }))).resolves.toEqual(ids);
    await expect(run(admin({ customPermissions: ['payments:write'] }))).resolves.toEqual(ids);
  });

  it('keeps only programs whose own grant carries the permission', async () => {
    const row = admin({
      adminPrograms: [
        { programId: 'program-1', permissions: ['payments:read'] },
        { programId: 'program-2', permissions: ['review:write'] },
        { programId: 'program-3', permissions: [] },
      ],
    });
    await expect(run(row)).resolves.toEqual(['program-1']);
  });

  it('returns nothing when no grant carries the permission', async () => {
    await expect(run(admin({ adminPrograms: [{ programId: 'program-1', permissions: ['review:write'] }] }))).resolves.toEqual([]);
  });
});
