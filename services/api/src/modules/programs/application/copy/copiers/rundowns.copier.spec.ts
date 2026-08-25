// services/api/src/modules/programs/application/copy/copiers/rundowns.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { RundownsCopier } from './rundowns.copier';
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

type RundownRow = {
  id: string;
  day: string;
  startTime: string | null;
  endTime: string | null;
  activity: string;
  description: string | null;
  location: string | null;
  speaker: string | null;
  order: number;
  isActive: boolean;
};

function rundown(over: Partial<RundownRow>): RundownRow {
  return {
    id: over.id ?? 'r1',
    day: over.day ?? 'Day 1',
    startTime: over.startTime ?? '09:00',
    endTime: over.endTime ?? '10:00',
    activity: over.activity ?? 'Opening Ceremony',
    description: over.description ?? null,
    location: over.location ?? null,
    speaker: over.speaker ?? null,
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() read and
// write through. Both model mocks share the same fixture-backed behavior,
// but are independently-tracked jest.fn() sets.
function mkPrisma(opts: { sourceItems?: RundownRow[]; existingItems?: RundownRow[] } = {}) {
  const buildModels = () => ({
    programSchedule: {
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
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.activity}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('RundownsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new RundownsCopier(mkPrisma().prisma);
    expect(copier.key).toBe('rundowns');
    expect(copier.label).toBe('Program Rundowns');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append dedupes on the (day, activity) composite, not activity alone (rows differing only in day do not collide)', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        rundown({ id: 's1', day: 'Day 1', activity: 'Opening Ceremony' }),
        // Same activity name on a different day is NOT a collision.
        rundown({ id: 's2', day: 'Day 2', activity: 'Opening Ceremony' }),
      ],
      existingItems: [rundown({ id: 't1', day: 'Day 1', activity: 'Opening Ceremony' })],
    });
    const copier = new RundownsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // Day 1 collides with the existing row; Day 2 does not.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('append dedupes on the (day, activity) composite, not day alone (rows differing only in activity do not collide)', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        rundown({ id: 's1', day: 'Day 1', activity: 'Opening Ceremony' }),
        // Same day, different activity — also NOT a collision.
        rundown({ id: 's2', day: 'Day 1', activity: 'Keynote Speech' }),
      ],
      existingItems: [rundown({ id: 't1', day: 'Day 1', activity: 'Opening Ceremony' })],
    });
    const copier = new RundownsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // 'Opening Ceremony' on Day 1 collides with the existing row;
    // 'Keynote Speech' on Day 1 does not.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  // day/activity are free-text VarChar columns (CreateProgramScheduleDto only
  // enforces @IsString() @IsNotEmpty(), no character restriction), so a fixed
  // separator like "::" is NOT provably collision-free: day="Day1::Extra",
  // activity="Foo" and day="Day1", activity="Extra::Foo" both naively
  // concatenate to "Day1::Extra::Foo". The composite key must disambiguate
  // these two distinct pairs.
  it('does not alias two distinct (day, activity) pairs whose naive "day::activity" concatenation would collide', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        rundown({ id: 's1', day: 'Day1::Extra', activity: 'Foo' }),
        rundown({ id: 's2', day: 'Day1', activity: 'Extra::Foo' }),
      ],
    });
    const copier = new RundownsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // Both are genuinely distinct pairs against an empty target — both must
    // be created, not deduped against each other.
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 0 });
  });

  it('replace soft-deletes existing items then inserts from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [rundown({ id: 's1', activity: 'a', order: 3 })],
      existingItems: [rundown({ id: 't1', activity: 'old' })],
    });
    const copier = new RundownsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (tx as any).programSchedule.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    // The whole point of the disjoint prisma/tx mock: prove the writes went
    // through the transactional client, not around it via the ambient
    // this.prisma the copier also holds for reads.
    expect((prisma as any).programSchedule.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programSchedule.create).not.toHaveBeenCalled();
  });

  it('copies day/startTime/endTime/location/speaker verbatim', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [rundown({ id: 's1', day: 'Day 2', startTime: '13:00', endTime: '14:30', location: 'Main Hall', speaker: 'Jane Doe' })],
    });
    const copier = new RundownsCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).programSchedule.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ day: 'Day 2', startTime: '13:00', endTime: '14:30', location: 'Main Hall', speaker: 'Jane Doe' }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with day as meta', async () => {
    const { prisma } = mkPrisma({ sourceItems: [rundown({ id: 's1', day: 'Day 1', activity: 'Opening Ceremony' })] });
    const copier = new RundownsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Opening Ceremony', meta: 'Day 1' }]);
  });
});

describe('RundownsCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const { prisma } = mkPrisma({ sourceItems: [rundown({ id: 's1', day: 'Day 1', activity: 'Registration' })] });
    const copier = new RundownsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([expect.objectContaining({ day: 'Day 1', activity: 'Registration' })]);
  });
});

describe('RundownsCopier.applyTemplate', () => {
  it('dedupes on the composite (day, activity), not on activity alone', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [rundown({ id: 't1', day: 'Day 1', activity: 'Registration' })] });
    const copier = new RundownsCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'rundowns',
        payloadVersion: 1,
        items: [
          { day: 'Day 1', startTime: null, endTime: null, activity: 'Registration', description: null, location: null, speaker: null, isActive: true },
          { day: 'Day 2', startTime: null, endTime: null, activity: 'Registration', description: null, location: null, speaker: null, isActive: true },
        ],
      },
      'tgt',
      'append',
    );
    // Same activity name on a different day is NOT a collision — only the
    // exact (day, activity) pair is.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('does not alias two distinct (day, activity) pairs whose naive "day::activity" concatenation would collide', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [] });
    const copier = new RundownsCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'rundowns',
        payloadVersion: 1,
        items: [
          { day: 'Day1::Extra', startTime: null, endTime: null, activity: 'Foo', description: null, location: null, speaker: null, isActive: true },
          { day: 'Day1', startTime: null, endTime: null, activity: 'Extra::Foo', description: null, location: null, speaker: null, isActive: true },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [rundown({ id: 't1', day: 'Day 1', activity: 'old' })] });
    const copier = new RundownsCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'rundowns', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programSchedule.updateMany).not.toHaveBeenCalled();
  });
});

describe('RundownsCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the rundown item on the target program', async () => {
    const { prisma, tx } = mkPrisma({ sourceItems: [rundown({ id: 's1', day: 'Day 2', activity: 'Keynote', speaker: 'Jane Doe' })] });
    const copier = new RundownsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programSchedule.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({ day: 'Day 2', activity: 'Keynote', speaker: 'Jane Doe' }));
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
