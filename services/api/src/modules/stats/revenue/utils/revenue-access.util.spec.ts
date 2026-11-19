// src/modules/stats/revenue/utils/revenue-access.util.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  assertProgramAccess,
  buildInvoiceScopeWhere,
  buildProgramScopeWhere,
  resolveRevenueAccessScope,
  RevenueAccessScope,
} from './revenue-access.util';

describe('buildInvoiceScopeWhere', () => {
  const platform: RevenueAccessScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
  const brandScoped: RevenueAccessScope = {
    kind: 'brand_scope',
    allowedBrandIds: ['brand-1', 'brand-2'],
    allowedProgramIds: null,
  };
  const assigned: RevenueAccessScope = {
    kind: 'assigned',
    allowedBrandIds: null,
    allowedProgramIds: ['program-1'],
  };

  it('platform admin with no brandId sees everything', () => {
    expect(buildInvoiceScopeWhere(platform)).toEqual({});
  });

  it('platform admin can scope down to any brandId', () => {
    expect(buildInvoiceScopeWhere(platform, 'brand-99')).toEqual({
      application: { program: { brandId: 'brand-99' } },
    });
  });

  it('brand-scoped admin with no brandId query param defaults to all of their own brands', () => {
    expect(buildInvoiceScopeWhere(brandScoped)).toEqual({
      application: { program: { brandId: { in: ['brand-1', 'brand-2'] } } },
    });
  });

  it('brand-scoped admin can narrow to one of their own brands', () => {
    expect(buildInvoiceScopeWhere(brandScoped, 'brand-2')).toEqual({
      application: { program: { brandId: 'brand-2' } },
    });
  });

  it('brand-scoped admin is REJECTED when requesting a brandId outside their own set', () => {
    expect(() => buildInvoiceScopeWhere(brandScoped, 'brand-other')).toThrow(ForbiddenException);
  });

  it('assigned-scope admin (no brand grant) is scoped to their explicit programIds', () => {
    expect(buildInvoiceScopeWhere(assigned)).toEqual({
      application: { programId: { in: ['program-1'] } },
    });
  });

  it('assigned-scope admin is REJECTED for any brandId query param', () => {
    expect(() => buildInvoiceScopeWhere(assigned, 'brand-1')).toThrow(ForbiddenException);
  });
});

describe('assertProgramAccess', () => {
  const program = { id: 'program-1', brandId: 'brand-1', name: 'Test Program', deletedAt: null };
  const mockPrisma = { program: { findUnique: jest.fn() } };

  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundException when the program does not exist or is soft-deleted', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(null);
    const scope: RevenueAccessScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
    await expect(assertProgramAccess(mockPrisma as any, scope, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('platform admin can access any program', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(program);
    const scope: RevenueAccessScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
    await expect(assertProgramAccess(mockPrisma as any, scope, 'program-1')).resolves.toEqual(program);
  });

  it('brand-scoped admin can access a program inside their allowed brands', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(program);
    const scope: RevenueAccessScope = { kind: 'brand_scope', allowedBrandIds: ['brand-1'], allowedProgramIds: null };
    await expect(assertProgramAccess(mockPrisma as any, scope, 'program-1')).resolves.toEqual(program);
  });

  it('brand-scoped admin is refused a program in a brand they do not own', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(program);
    const scope: RevenueAccessScope = { kind: 'brand_scope', allowedBrandIds: ['brand-other'], allowedProgramIds: null };
    await expect(assertProgramAccess(mockPrisma as any, scope, 'program-1')).rejects.toThrow(NotFoundException);
  });

  it('assigned-scope admin can only access explicitly assigned programIds', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(program);
    const allowed: RevenueAccessScope = { kind: 'assigned', allowedBrandIds: null, allowedProgramIds: ['program-1'] };
    await expect(assertProgramAccess(mockPrisma as any, allowed, 'program-1')).resolves.toEqual(program);

    const forbidden: RevenueAccessScope = { kind: 'assigned', allowedBrandIds: null, allowedProgramIds: ['program-other'] };
    await expect(assertProgramAccess(mockPrisma as any, forbidden, 'program-1')).rejects.toThrow(NotFoundException);
  });

  // The point of the change: a scoped admin must not be able to tell "does not
  // exist" from "exists but is not yours". Before this, the status code alone
  // let an admin scoped to brand A enumerate which programme ids exist in brand
  // B. No data was disclosed, which is why it was medium - but it is exactly the
  // existence oracle the id-keyed routes were otherwise built to avoid.
  it('gives a scoped admin the SAME answer for missing and out-of-scope', async () => {
    const scope: RevenueAccessScope = { kind: 'brand_scope', allowedBrandIds: ['brand-other'], allowedProgramIds: null };

    mockPrisma.program.findUnique.mockResolvedValue(null);
    const whenMissing = await assertProgramAccess(mockPrisma as any, scope, 'program-1').catch((e) => e);

    mockPrisma.program.findUnique.mockResolvedValue(program);
    const whenOutOfScope = await assertProgramAccess(mockPrisma as any, scope, 'program-1').catch((e) => e);

    expect(whenMissing.constructor).toBe(whenOutOfScope.constructor);
    expect(whenMissing.getStatus()).toBe(whenOutOfScope.getStatus());
    expect(whenMissing.message).toBe(whenOutOfScope.message);
  });

  // A platform admin sees every programme, so telling them the truth leaks
  // nothing - and a genuine 404 is the more useful answer.
  it('still tells a platform admin honestly that a program does not exist', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(null);
    const scope: RevenueAccessScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };

    await expect(assertProgramAccess(mockPrisma as any, scope, 'nope')).rejects.toThrow(NotFoundException);
  });
});

// The lockout fix: a brand_scope admin who ALSO holds an admin_programs row
// outside their brands. Admin login lists that programme in the dashboard, so
// every scoped route must let them reach it too.
describe('resolveRevenueAccessScope', () => {
  const mockPrisma = { admin: { findUnique: jest.fn() } };
  const user = { userId: 'user-1', adminId: 'admin-1' } as any;
  const baseAdmin = { accessLevel: 1, canManageAdmins: false, canAssignRoles: false, customPermissions: [], role: null };

  beforeEach(() => jest.clearAllMocks());

  it('platform admin carries no restriction at all', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...baseAdmin,
      accessLevel: 10,
      adminBrands: [{ brandId: 'brand-1' }],
      adminPrograms: [{ programId: 'program-x' }],
    });
    await expect(resolveRevenueAccessScope(mockPrisma as any, user)).resolves.toEqual({
      kind: 'platform',
      allowedBrandIds: null,
      allowedProgramIds: null,
    });
  });

  it('brand-only admin gets their brands and an empty programme grant list', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({ ...baseAdmin, adminBrands: [{ brandId: 'brand-1' }], adminPrograms: [] });
    await expect(resolveRevenueAccessScope(mockPrisma as any, user)).resolves.toEqual({
      kind: 'brand_scope',
      allowedBrandIds: ['brand-1'],
      allowedProgramIds: [],
    });
  });

  it('brand admin with an extra programme assignment keeps that programme in scope', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...baseAdmin,
      adminBrands: [{ brandId: 'brand-1' }],
      adminPrograms: [{ programId: 'program-x' }],
    });
    await expect(resolveRevenueAccessScope(mockPrisma as any, user)).resolves.toEqual({
      kind: 'brand_scope',
      allowedBrandIds: ['brand-1'],
      allowedProgramIds: ['program-x'],
    });
  });

  it('assigned-only admin is scoped to exactly their programmes', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({ ...baseAdmin, adminBrands: [], adminPrograms: [{ programId: 'program-1' }] });
    await expect(resolveRevenueAccessScope(mockPrisma as any, user)).resolves.toEqual({
      kind: 'assigned',
      allowedBrandIds: null,
      allowedProgramIds: ['program-1'],
    });
  });
});

describe('brand_scope + explicit programme grant', () => {
  const brandPlusExtra: RevenueAccessScope = {
    kind: 'brand_scope',
    allowedBrandIds: ['brand-1'],
    allowedProgramIds: ['program-x'],
  };
  const mockPrisma = { program: { findUnique: jest.fn() } };

  beforeEach(() => jest.clearAllMocks());

  it('passes assertProgramAccess for the extra programme in a brand they do not hold', async () => {
    const extra = { id: 'program-x', brandId: 'brand-other', name: 'Extra', deletedAt: null };
    mockPrisma.program.findUnique.mockResolvedValue(extra);
    await expect(assertProgramAccess(mockPrisma as any, brandPlusExtra, 'program-x')).resolves.toEqual(extra);
  });

  it('still refuses any other programme in that foreign brand', async () => {
    mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-y', brandId: 'brand-other', name: 'Y', deletedAt: null });
    await expect(assertProgramAccess(mockPrisma as any, brandPlusExtra, 'program-y')).rejects.toThrow(NotFoundException);
  });

  it('list filters OR the extra programme onto the brand filter', () => {
    expect(buildInvoiceScopeWhere(brandPlusExtra)).toEqual({
      OR: [
        { application: { program: { brandId: { in: ['brand-1'] } } } },
        { application: { programId: { in: ['program-x'] } } },
      ],
    });
    expect(buildProgramScopeWhere(brandPlusExtra)).toEqual({
      OR: [{ brandId: { in: ['brand-1'] } }, { id: { in: ['program-x'] } }],
    });
  });

  it('does not widen an explicit brandId: the extra programme brand is still refused', () => {
    expect(() => buildInvoiceScopeWhere(brandPlusExtra, 'brand-other')).toThrow(ForbiddenException);
    expect(buildInvoiceScopeWhere(brandPlusExtra, 'brand-1')).toEqual({
      application: { program: { brandId: 'brand-1' } },
    });
  });

  it('brand-only admin (empty grant list) keeps the exact pre-change filter shape', () => {
    const brandOnly: RevenueAccessScope = { kind: 'brand_scope', allowedBrandIds: ['brand-1'], allowedProgramIds: [] };
    expect(buildInvoiceScopeWhere(brandOnly)).toEqual({ application: { program: { brandId: { in: ['brand-1'] } } } });
    expect(buildProgramScopeWhere(brandOnly)).toEqual({ brandId: { in: ['brand-1'] } });
  });

  it('platform filters are unchanged', () => {
    const platform: RevenueAccessScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
    expect(buildProgramScopeWhere(platform)).toEqual({});
    expect(buildProgramScopeWhere(platform, 'brand-9')).toEqual({ brandId: 'brand-9' });
  });
});
