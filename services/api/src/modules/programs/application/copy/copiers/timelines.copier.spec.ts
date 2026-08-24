// services/api/src/modules/programs/application/copy/copiers/timelines.copier.spec.ts
import { TimelinesCopier } from './timelines.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type TimelineRow = {
  id: string;
  date: Date;
  endDate: Date | null;
  title: string;
  description: string | null;
  icon: string | null;
  type: string;
  completionType: string;
  completionConfig: unknown;
  targetAudience: string;
  order: number;
  isActive: boolean;
};

function timeline(over: Partial<TimelineRow>): TimelineRow {
  return {
    id: over.id ?? 't1',
    date: over.date ?? new Date('2027-01-01T00:00:00Z'),
    endDate: over.endDate ?? null,
    title: over.title ?? 'Registration Opens',
    description: over.description ?? null,
    icon: over.icon ?? null,
    type: over.type ?? 'custom',
    completionType: over.completionType ?? 'date_passed',
    completionConfig: over.completionConfig ?? {},
    targetAudience: over.targetAudience ?? 'all',
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

function mkPrisma(opts: { sourceItems?: TimelineRow[]; existingItems?: TimelineRow[] } = {}): PrismaService {
  const base: any = {
    programTimeline: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      // Mirrors real Prisma updateMany: count reflects the rows actually
      // matched by the where clause (the target's existing rows here), not
      // a fixed stub — otherwise the replace-mode `replaced` assertion below
      // could never be satisfied by any implementation. Same fix as
      // form-fields.copier.spec.ts / copy-scoped-rows.spec.ts's fake delegate.
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceItems : opts.existingItems)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.title}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('TimelinesCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new TimelinesCopier(mkPrisma());
    expect(copier.key).toBe('timelines');
    expect(copier.label).toBe('Timelines');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new items and dedupes on title', async () => {
    const prisma = mkPrisma({
      sourceItems: [timeline({ id: 's1', title: 'Registration Opens' }), timeline({ id: 's2', title: 'Interview Week' })],
      existingItems: [timeline({ id: 't1', title: 'Registration Opens' })],
    });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing items then inserts from order 0', async () => {
    const prisma = mkPrisma({
      sourceItems: [timeline({ id: 's1', title: 'a', order: 3 })],
      existingItems: [timeline({ id: 't1', title: 'old' })],
    });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programTimeline.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (prisma as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('copies date, completionConfig, and targetAudience verbatim', async () => {
    const prisma = mkPrisma({
      sourceItems: [
        timeline({
          id: 's1',
          title: 'Payment Deadline',
          date: new Date('2027-03-15T00:00:00Z'),
          completionType: 'payment_completed',
          completionConfig: { feeType: 'registration_fee' },
          targetAudience: 'accepted',
        }),
      ],
    });
    const copier = new TimelinesCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        date: new Date('2027-03-15T00:00:00Z'),
        completionType: 'payment_completed',
        completionConfig: { feeType: 'registration_fee' },
        targetAudience: 'accepted',
      }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with the ISO date as meta', async () => {
    const prisma = mkPrisma({ sourceItems: [timeline({ id: 's1', title: 'Registration Opens', date: new Date('2027-01-01T00:00:00Z') })] });
    const copier = new TimelinesCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Registration Opens', meta: '2027-01-01' }]);
  });
});
