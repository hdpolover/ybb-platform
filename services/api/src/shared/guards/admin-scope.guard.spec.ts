// src/shared/guards/admin-scope.guard.spec.ts
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ADMIN_SCOPE_KEY,
  AdminScope,
  AdminScopeGuard,
  ScopedByMetadata,
  assertBrandAccess,
  getRequestAdminScope,
} from './admin-scope.guard';

const SUPER_ADMIN = {
  accessLevel: 10,
  canManageAdmins: true,
  canAssignRoles: true,
  customPermissions: [],
  role: { name: 'super admin', permissions: ['*'] },
  adminBrands: [],
  adminPrograms: [],
};

const BRAND_ADMIN = {
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'admin', permissions: [] },
  adminBrands: [{ brandId: 'brand-mine', permissions: [] }],
  adminPrograms: [],
};

const PROGRAM_ADMIN = {
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'admin', permissions: [] },
  adminBrands: [],
  adminPrograms: [{ programId: 'program-mine', permissions: [] }],
};

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function buildGuard(metadata: ScopedByMetadata | undefined, prismaRead: unknown) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === ADMIN_SCOPE_KEY ? metadata : undefined)),
  } as unknown as Reflector;

  return new AdminScopeGuard(reflector, prismaRead as never);
}

describe('assertBrandAccess', () => {
  const platform: AdminScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
  const brandScoped: AdminScope = {
    kind: 'brand_scope',
    allowedBrandIds: ['brand-mine'],
    allowedProgramIds: null,
  };
  const assigned: AdminScope = {
    kind: 'assigned',
    allowedBrandIds: null,
    allowedProgramIds: ['program-mine'],
  };

  it('lets a platform admin through for any brand', () => {
    expect(() => assertBrandAccess(platform, 'any-brand')).not.toThrow();
  });

  it('lets a brand-scoped admin through for their own brand', () => {
    expect(() => assertBrandAccess(brandScoped, 'brand-mine')).not.toThrow();
  });

  it('rejects a brand-scoped admin on someone else’s brand', () => {
    expect(() => assertBrandAccess(brandScoped, 'brand-theirs')).toThrow(ForbiddenException);
  });

  it('rejects a program-assigned admin on any brand (they hold no brand grant)', () => {
    expect(() => assertBrandAccess(assigned, 'brand-mine')).toThrow(ForbiddenException);
  });
});

describe('getRequestAdminScope', () => {
  it('resolves the admin once per request and reuses the memoized scope', async () => {
    const prismaRead = { admin: { findUnique: jest.fn().mockResolvedValue(BRAND_ADMIN) } };
    const request = { user: { adminId: 'admin-1' } };

    const first = await getRequestAdminScope(prismaRead as never, request);
    const second = await getRequestAdminScope(prismaRead as never, request);

    expect(first).toBe(second);
    expect(first.kind).toBe('brand_scope');
    expect(prismaRead.admin.findUnique).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the request carries no adminId', async () => {
    const prismaRead = { admin: { findUnique: jest.fn() } };

    const scope = await getRequestAdminScope(prismaRead as never, {});

    expect(scope).toEqual({ kind: 'assigned', allowedBrandIds: [], allowedProgramIds: [] });
    expect(prismaRead.admin.findUnique).not.toHaveBeenCalled();
  });
});

describe('AdminScopeGuard', () => {
  it('is a no-op (and costs no lookup) on routes without @ScopedBy', async () => {
    const prismaRead = { admin: { findUnique: jest.fn() } };
    const guard = buildGuard(undefined, prismaRead);

    await expect(guard.canActivate(buildContext({ user: { adminId: 'admin-1' } }))).resolves.toBe(true);
    expect(prismaRead.admin.findUnique).not.toHaveBeenCalled();
  });

  it('lets a platform admin through every scoped route unchanged', async () => {
    const prismaRead = { admin: { findUnique: jest.fn().mockResolvedValue(SUPER_ADMIN) } };
    const guard = buildGuard({ target: 'platform', paramName: 'id' }, prismaRead);

    await expect(
      guard.canActivate(buildContext({ user: { adminId: 'admin-1' }, params: {} })),
    ).resolves.toBe(true);
  });

  it('refuses a platform-only route for a brand-scoped admin', async () => {
    const prismaRead = { admin: { findUnique: jest.fn().mockResolvedValue(BRAND_ADMIN) } };
    const guard = buildGuard({ target: 'platform', paramName: 'id' }, prismaRead);

    await expect(
      guard.canActivate(buildContext({ user: { adminId: 'admin-1' }, params: {} })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checks a brand route against the named param', async () => {
    const prismaRead = { admin: { findUnique: jest.fn().mockResolvedValue(BRAND_ADMIN) } };
    const guard = buildGuard({ target: 'brand', paramName: 'id' }, prismaRead);

    await expect(
      guard.canActivate(buildContext({ user: { adminId: 'admin-1' }, params: { id: 'brand-mine' } })),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(buildContext({ user: { adminId: 'admin-1' }, params: { id: 'brand-theirs' } })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('resolves a program route through the program’s own brand, not the request', async () => {
    const prismaRead = {
      admin: { findUnique: jest.fn().mockResolvedValue(BRAND_ADMIN) },
      program: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'program-1',
          brandId: 'brand-theirs',
          name: 'Foreign program',
          deletedAt: null,
        }),
      },
    };
    const guard = buildGuard({ target: 'program', paramName: 'id' }, prismaRead);

    await expect(
      guard.canActivate(buildContext({ user: { adminId: 'admin-1' }, params: { id: 'program-1' } })),
    ).rejects.toThrow(NotFoundException);
  });

  it('lets a program-assigned admin reach only their assigned program', async () => {
    const prismaRead = {
      admin: { findUnique: jest.fn().mockResolvedValue(PROGRAM_ADMIN) },
      program: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'program-mine',
          brandId: 'brand-any',
          name: 'Mine',
          deletedAt: null,
        }),
      },
    };
    const guard = buildGuard({ target: 'program', paramName: 'id' }, prismaRead);

    await expect(
      guard.canActivate(
        buildContext({ user: { adminId: 'admin-1' }, params: { id: 'program-mine' } }),
      ),
    ).resolves.toBe(true);
  });

  it('404s a program that does not exist rather than leaking a scope answer', async () => {
    const prismaRead = {
      admin: { findUnique: jest.fn().mockResolvedValue(PROGRAM_ADMIN) },
      program: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const guard = buildGuard({ target: 'program', paramName: 'id' }, prismaRead);

    await expect(
      guard.canActivate(buildContext({ user: { adminId: 'admin-1' }, params: { id: 'nope' } })),
    ).rejects.toThrow(NotFoundException);
  });

  it('fails closed when the scoped param is missing from the route', async () => {
    const prismaRead = { admin: { findUnique: jest.fn().mockResolvedValue(BRAND_ADMIN) } };
    const guard = buildGuard({ target: 'brand', paramName: 'id' }, prismaRead);

    await expect(
      guard.canActivate(buildContext({ user: { adminId: 'admin-1' }, params: {} })),
    ).rejects.toThrow(ForbiddenException);
  });
});
