// services/api/src/modules/programs/application/copy/copiers/timelines.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { TimelinesCopier } from './timelines.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

// Mirrors form-fields.copier.spec.ts's helper: BadRequestException here
// carries a structured { code, message } response body, and Nest's
// HttpException surfaces that body's own `message` string as the thrown
// error's `.message` — not the `code` — so `.rejects.toThrow(/code/)` can
// never match. Asserting on `.getResponse().code` is this codebase's
// established way to check a structured exception's code.
async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

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

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() read and
// write through. Both model mocks share the same fixture-backed behavior,
// but are independently-tracked jest.fn() sets.
function mkPrisma(opts: { sourceItems?: TimelineRow[]; existingItems?: TimelineRow[] } = {}) {
  const buildModels = () => ({
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
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('TimelinesCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new TimelinesCopier(mkPrisma().prisma);
    expect(copier.key).toBe('timelines');
    expect(copier.label).toBe('Timelines');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new items and dedupes on title', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [timeline({ id: 's1', title: 'Registration Opens' }), timeline({ id: 's2', title: 'Interview Week' })],
      existingItems: [timeline({ id: 't1', title: 'Registration Opens' })],
    });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing items then inserts from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [timeline({ id: 's1', title: 'a', order: 3 })],
      existingItems: [timeline({ id: 't1', title: 'old' })],
    });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programTimeline.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (tx as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    // The whole point of the disjoint prisma/tx mock: prove the writes went
    // through the transactional client, not around it via the ambient
    // this.prisma the copier also holds for reads.
    expect((prisma as any).programTimeline.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programTimeline.create).not.toHaveBeenCalled();
  });

  it('copies date, completionConfig, and targetAudience verbatim', async () => {
    const { prisma, tx } = mkPrisma({
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
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).programTimeline.create as jest.Mock;
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
    const { prisma } = mkPrisma({ sourceItems: [timeline({ id: 's1', title: 'Registration Opens', date: new Date('2027-01-01T00:00:00Z') })] });
    const copier = new TimelinesCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Registration Opens', meta: '2027-01-01' }]);
  });
});

describe('TimelinesCopier.exportTemplate', () => {
  it('exports date/endDate as ISO strings', async () => {
    const { prisma } = mkPrisma({
      sourceItems: [timeline({ id: 's1', title: 'Kickoff', date: new Date('2027-01-01T00:00:00.000Z'), endDate: null })],
    });
    const copier = new TimelinesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items[0]).toEqual(expect.objectContaining({ title: 'Kickoff', date: '2027-01-01T00:00:00.000Z', endDate: null }));
  });
});

describe('TimelinesCopier.applyTemplate', () => {
  it('append parses ISO date strings back into Date values and inserts', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [] });
    const copier = new TimelinesCopier(prisma);
    await copier.applyTemplate(
      tx,
      {
        entityType: 'timelines',
        payloadVersion: 1,
        items: [
          {
            date: '2027-01-01T00:00:00.000Z',
            endDate: null,
            title: 'Kickoff',
            description: null,
            icon: null,
            // 'milestone' is not a TimelineType enum member (registration,
            // announcement_loa, payment_1, payment_2, mentoring, interview,
            // announcement_final, program_start, program_end, onboarding,
            // custom) — 'custom' is the closest valid stand-in.
            type: 'custom',
            completionType: 'manual',
            completionConfig: {},
            targetAudience: 'all',
            isActive: true,
          },
        ],
      },
      'tgt',
      'append',
    );
    const create = (tx as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data.date).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it('dedupes on title and skips a collision', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [timeline({ id: 't1', title: 'Kickoff' })] });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'timelines',
        payloadVersion: 1,
        items: [
          {
            date: '2027-01-01T00:00:00.000Z',
            endDate: null,
            title: 'Kickoff',
            description: null,
            icon: null,
            type: 'custom',
            completionType: 'manual',
            completionConfig: {},
            targetAudience: 'all',
            isActive: true,
          },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [timeline({ id: 't1', title: 'old' })] });
    const copier = new TimelinesCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'timelines', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programTimeline.updateMany).not.toHaveBeenCalled();
  });
});

describe('TimelinesCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the timeline item on the target program, dates included', async () => {
    const { prisma, tx } = mkPrisma({ sourceItems: [timeline({ id: 's1', title: 'Kickoff', date: new Date('2027-01-01T00:00:00.000Z') })] });
    const copier = new TimelinesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data.title).toBe('Kickoff');
    expect(create.mock.calls[0][0].data.date).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
