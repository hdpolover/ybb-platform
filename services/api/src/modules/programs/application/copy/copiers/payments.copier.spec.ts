// services/api/src/modules/programs/application/copy/copiers/payments.copier.spec.ts
import { PaymentsCopier } from './payments.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type ValidityPeriodRow = { id: string; pricingTierId: string; startDate: Date; endDate: Date; description: string | null };
type TierRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  usdPrice: number | null;
  idrPrice: number | null;
  capacity: number | null;
  currentCount: number;
  benefits: string[];
  requirements: string[];
  feeType: string;
  allowedCategories: string[];
  icon: string | null;
  soldCount: number;
  isActive: boolean;
  order: number;
  validityPeriods: ValidityPeriodRow[];
};

function tier(over: Partial<TierRow>): TierRow {
  return {
    id: over.id ?? 'p1',
    name: over.name ?? 'Early Bird',
    description: over.description ?? null,
    price: over.price ?? 100,
    currency: over.currency ?? 'USD',
    usdPrice: over.usdPrice ?? 100,
    idrPrice: over.idrPrice ?? 1500000,
    capacity: over.capacity ?? null,
    currentCount: over.currentCount ?? 42,
    benefits: over.benefits ?? [],
    requirements: over.requirements ?? [],
    feeType: over.feeType ?? 'registration_fee',
    allowedCategories: over.allowedCategories ?? ['self_funded'],
    icon: over.icon ?? null,
    soldCount: over.soldCount ?? 17,
    isActive: over.isActive ?? true,
    order: over.order ?? 0,
    validityPeriods: over.validityPeriods ?? [],
  };
}

function mkPrisma(opts: { sourceTiers?: TierRow[]; existingTiers?: TierRow[] } = {}): PrismaService {
  const base: any = {
    programPricingTier: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceTiers : opts.existingTiers) ?? []),
      ),
      // Mirrors real Prisma updateMany: count reflects the rows actually
      // matched by the where clause (the target's existing rows here), not
      // a fixed stub — otherwise the replace-mode `replaced` assertion below
      // could never be satisfied by any implementation. Same fix applied in
      // timelines/rundowns/faqs/participation-categories copier specs.
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceTiers : opts.existingTiers)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceTiers ?? []).length),
    },
    pricingTierValidityPeriod: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `period-${Math.random()}`, ...data })),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('PaymentsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new PaymentsCopier(mkPrisma());
    expect(copier.key).toBe('payments');
    expect(copier.label).toBe('Payment Options');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new tiers, dedupes on name, and resets soldCount/currentCount to 0', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'Early Bird', soldCount: 30, currentCount: 30 })],
      existingTiers: [],
    });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programPricingTier.create as jest.Mock;
    expect(create.mock.calls[0][0].data.soldCount).toBe(0);
    expect(create.mock.calls[0][0].data.currentCount).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('append copies capacity verbatim as content, not reset like the live counters', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'Early Bird', capacity: 250 })],
      existingTiers: [],
    });
    const copier = new PaymentsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programPricingTier.create as jest.Mock;
    expect(create.mock.calls[0][0].data.capacity).toBe(250);
  });

  it('append skips a tier whose name collides with an existing tier', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'Early Bird' })],
      existingTiers: [tier({ id: 't1', name: 'Early Bird' })],
    });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
  });

  it('remaps validity periods to the newly created tier id, not the source tier id', async () => {
    const prisma = mkPrisma({
      sourceTiers: [
        tier({
          id: 's1',
          name: 'Early Bird',
          validityPeriods: [
            { id: 'vp1', pricingTierId: 's1', startDate: new Date('2027-01-01'), endDate: new Date('2027-02-01'), description: 'Wave 1' },
            { id: 'vp2', pricingTierId: 's1', startDate: new Date('2027-02-01'), endDate: new Date('2027-03-01'), description: 'Wave 2' },
          ],
        }),
      ],
    });
    const copier = new PaymentsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const periodCreate = (prisma as any).pricingTierValidityPeriod.create as jest.Mock;
    expect(periodCreate).toHaveBeenCalledTimes(2);
    expect(periodCreate.mock.calls[0][0].data.pricingTierId).toBe('new-Early Bird');
    expect(periodCreate.mock.calls[0][0].data.pricingTierId).not.toBe('s1');
    expect(periodCreate.mock.calls[0][0].data.description).toBe('Wave 1');
  });

  it('remaps validity periods correctly across two distinct tiers, using distinguishable ids to catch a swap', async () => {
    const prisma = mkPrisma({
      sourceTiers: [
        tier({
          id: 's-alpha',
          name: 'Alpha',
          validityPeriods: [{ id: 'vp-a', pricingTierId: 's-alpha', startDate: new Date('2027-01-01'), endDate: new Date('2027-02-01'), description: 'Alpha wave' }],
        }),
        tier({
          id: 's-beta',
          name: 'Beta',
          validityPeriods: [{ id: 'vp-b', pricingTierId: 's-beta', startDate: new Date('2027-03-01'), endDate: new Date('2027-04-01'), description: 'Beta wave' }],
        }),
      ],
    });
    const copier = new PaymentsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const periodCreate = (prisma as any).pricingTierValidityPeriod.create as jest.Mock;
    expect(periodCreate).toHaveBeenCalledTimes(2);
    const alphaCall = periodCreate.mock.calls.find((c) => c[0].data.description === 'Alpha wave');
    const betaCall = periodCreate.mock.calls.find((c) => c[0].data.description === 'Beta wave');
    expect(alphaCall[0].data.pricingTierId).toBe('new-Alpha');
    expect(betaCall[0].data.pricingTierId).toBe('new-Beta');
    expect(alphaCall[0].data.pricingTierId).not.toBe(betaCall[0].data.pricingTierId);
  });

  it('replace soft-deletes existing tiers then inserts from order 0', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'a', order: 3 })],
      existingTiers: [tier({ id: 't1', name: 'old' })],
    });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programPricingTier.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    const create = (prisma as any).programPricingTier.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('append: empty source is a no-op', async () => {
    const prisma = mkPrisma({ sourceTiers: [] });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
    expect((prisma as any).programPricingTier.create).not.toHaveBeenCalled();
  });

  // copy-scoped-rows.ts's replace/append semantics (which the other five
  // copiers get for free) must be reproduced here by hand, since Payments
  // is the one copier that doesn't route through that helper.
  it('replace: empty source rejects before any mutation, instead of soft-deleting the target for nothing', async () => {
    const prisma = mkPrisma({ sourceTiers: [], existingTiers: [tier({ id: 't1', name: 'old' })] });
    const copier = new PaymentsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toThrow(/empty selection/i);
    expect((prisma as any).programPricingTier.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programPricingTier.create).not.toHaveBeenCalled();
    expect((prisma as any).pricingTierValidityPeriod.create).not.toHaveBeenCalled();
  });

  it('replace: a non-empty source filtered by itemIds down to zero also rejects before any mutation', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'a' })],
      existingTiers: [tier({ id: 't1', name: 'old' })],
    });
    const copier = new PaymentsCopier(prisma);
    await expect(
      copier.copy(prisma, {
        sourceProgramId: 'src',
        targetProgramId: 'tgt',
        itemIds: ['does-not-exist'],
        mode: 'replace',
      }),
    ).rejects.toThrow(/empty selection/i);
    expect((prisma as any).programPricingTier.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programPricingTier.create).not.toHaveBeenCalled();
  });

  it('preview() maps rows to CopyPreviewItem with currency+price as meta', async () => {
    const prisma = mkPrisma({ sourceTiers: [tier({ id: 's1', name: 'Early Bird', currency: 'USD', price: 150 })] });
    const copier = new PaymentsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Early Bird', meta: 'USD 150' }]);
  });
});
