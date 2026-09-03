// src/modules/stats/revenue/utils/revenue-access.util.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertProgramAccess, buildInvoiceScopeWhere, RevenueAccessScope } from './revenue-access.util';

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
