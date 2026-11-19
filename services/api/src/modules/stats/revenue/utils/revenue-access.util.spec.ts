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
  const platform: RevenueAccessScope = { kind: 'platform', allowedProgramIds: null };
  const assigned: RevenueAccessScope = { kind: 'assigned', allowedProgramIds: ['program-1'] };

  it('platform admin with no brandId sees everything', () => {
    expect(buildInvoiceScopeWhere(platform)).toEqual({});
  });

  it('platform admin can scope down to any brandId', () => {
    expect(buildInvoiceScopeWhere(platform, 'brand-99')).toEqual({
      application: { program: { brandId: 'brand-99' } },
    });
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
    const scope: RevenueAccessScope = { kind: 'platform', allowedProgramIds: null };
    await expect(assertProgramAccess(mockPrisma as any, scope, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('platform admin can access any program', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(program);
    const scope: RevenueAccessScope = { kind: 'platform', allowedProgramIds: null };
    await expect(assertProgramAccess(mockPrisma as any, scope, 'program-1')).resolves.toEqual(program);
  });

  it('assigned-scope admin can only access explicitly assigned programIds', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(program);
    const allowed: RevenueAccessScope = { kind: 'assigned', allowedProgramIds: ['program-1'] };
    await expect(assertProgramAccess(mockPrisma as any, allowed, 'program-1')).resolves.toEqual(program);

    const forbidden: RevenueAccessScope = { kind: 'assigned', allowedProgramIds: ['program-other'] };
    await expect(assertProgramAccess(mockPrisma as any, forbidden, 'program-1')).rejects.toThrow(NotFoundException);
  });

  // The point of the change: a scoped admin must not be able to tell "does not
  // exist" from "exists but is not yours". Before this, the status code alone
  // let an admin scoped to brand A enumerate which programme ids exist in brand
  // B. No data was disclosed, which is why it was medium - but it is exactly the
  // existence oracle the id-keyed routes were otherwise built to avoid.
  it('gives a scoped admin the SAME answer for missing and out-of-scope', async () => {
    const scope: RevenueAccessScope = { kind: 'assigned', allowedProgramIds: ['program-other'] };

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
    const scope: RevenueAccessScope = { kind: 'platform', allowedProgramIds: null };

    await expect(assertProgramAccess(mockPrisma as any, scope, 'nope')).rejects.toThrow(NotFoundException);
  });
});

// Owner policy 2026-11-19: programme access comes ONLY from admin_programs rows.
// A brand row (admin_brands) must never widen it, today or for a future edition.
describe('resolveRevenueAccessScope', () => {
  const mockPrisma = { admin: { findUnique: jest.fn() } };
  const user = { userId: 'user-1', adminId: 'admin-1' } as any;
  const baseAdmin = { accessLevel: 1, canManageAdmins: false, canAssignRoles: false, customPermissions: [], role: null };

  beforeEach(() => jest.clearAllMocks());

  it('platform admin carries no restriction at all', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({ ...baseAdmin, accessLevel: 10, adminPrograms: [{ programId: 'program-x' }] });
    await expect(resolveRevenueAccessScope(mockPrisma as any, user)).resolves.toEqual({
      kind: 'platform',
      allowedProgramIds: null,
    });
  });

  it('assigned admin is scoped to exactly their programmes', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({ ...baseAdmin, adminPrograms: [{ programId: 'program-1' }] });
    await expect(resolveRevenueAccessScope(mockPrisma as any, user)).resolves.toEqual({
      kind: 'assigned',
      allowedProgramIds: ['program-1'],
    });
  });

  it('never reads admin_brands, so a brand row cannot widen the scope', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...baseAdmin,
      adminBrands: [{ brandId: 'brand-1', permissions: ['*'] }],
      adminPrograms: [{ programId: 'program-1' }],
    });
    await expect(resolveRevenueAccessScope(mockPrisma as any, user)).resolves.toEqual({
      kind: 'assigned',
      allowedProgramIds: ['program-1'],
    });
    expect(mockPrisma.admin.findUnique.mock.calls[0][0].select.adminBrands).toBeUndefined();
  });
});

describe('a brand row grants no programme', () => {
  const assigned: RevenueAccessScope = { kind: 'assigned', allowedProgramIds: ['program-x'] };
  const mockPrisma = { program: { findUnique: jest.fn() } };

  beforeEach(() => jest.clearAllMocks());

  it('404s an unassigned programme even in the brand of an assigned one', async () => {
    mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-y', brandId: 'brand-1', name: 'Y', deletedAt: null });
    await expect(assertProgramAccess(mockPrisma as any, assigned, 'program-y')).rejects.toThrow(NotFoundException);
  });

  it('list filters are the assigned programmes only, never a brand filter', () => {
    expect(buildInvoiceScopeWhere(assigned)).toEqual({ application: { programId: { in: ['program-x'] } } });
    expect(buildProgramScopeWhere(assigned)).toEqual({ id: { in: ['program-x'] } });
    expect(() => buildProgramScopeWhere(assigned, 'brand-1')).toThrow(ForbiddenException);
  });

  it('platform filters are unchanged', () => {
    const platform: RevenueAccessScope = { kind: 'platform', allowedProgramIds: null };
    expect(buildProgramScopeWhere(platform)).toEqual({});
    expect(buildProgramScopeWhere(platform, 'brand-9')).toEqual({ brandId: 'brand-9' });
  });
});
