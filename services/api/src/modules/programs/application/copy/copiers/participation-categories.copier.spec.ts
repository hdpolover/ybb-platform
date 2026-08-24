// services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ParticipationCategoriesCopier } from './participation-categories.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

// Mirrors form-fields.copier.spec.ts / program-details.copier.spec.ts's
// helper: BadRequestException here carries a structured { code, message }
// response body, and Nest's HttpException surfaces that body's own `message`
// string as the thrown error's `.message` — not the `code` — so
// `.rejects.toThrow(/code/)` can never match. Asserting on
// `.getResponse().code` is this codebase's established way to check a
// structured exception's code.
async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  benefits: string | null;
  eligibility: string | null;
  order: number;
  isActive: boolean;
};

function category(over: Partial<CategoryRow>): CategoryRow {
  return {
    id: over.id ?? 'c1',
    name: over.name ?? 'Category One',
    description: over.description ?? null,
    benefits: over.benefits ?? null,
    eligibility: over.eligibility ?? null,
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() — and the
// refuseIfInUse in-use guard they call — read and write through. Both model
// mocks share the same fixture-backed behavior, but are independently-
// tracked jest.fn() sets.
function mkPrisma(opts: {
  sourceCategories?: CategoryRow[];
  existingCategories?: CategoryRow[];
  referencingApplicationCount?: number;
} = {}) {
  const buildModels = () => ({
    programParticipationCategory: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceCategories : opts.existingCategories) ?? []),
      ),
      // Mirrors real Prisma updateMany: count reflects the rows actually
      // matched by the where clause (the target's existing rows here), not
      // a fixed stub — otherwise the replace-mode `replaced` assertion below
      // could never be satisfied by any implementation built on
      // copyScopedRows, which derives `replaced` from this return value.
      // Same fix as form-fields.copier.spec.ts's mkPrisma.
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceCategories : opts.existingCategories)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceCategories ?? []).length),
    },
    participantApplication: {
      count: jest.fn().mockResolvedValue(opts.referencingApplicationCount ?? 0),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('ParticipationCategoriesCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ParticipationCategoriesCopier(mkPrisma().prisma);
    expect(copier.key).toBe('participation-categories');
    expect(copier.label).toBe('Participation Categories');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new categories and dedupes on name', async () => {
    const { prisma, tx } = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'High School' }), category({ id: 's2', name: 'University' })],
      existingCategories: [category({ id: 't1', name: 'High School' })],
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing categories via deletedAt + isActive when none are referenced by applications', async () => {
    const { prisma, tx } = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 0,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programParticipationCategory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    // Pins the guard to the TARGET's live category ids ('t1'), not the
    // source's ('s1'). Without this assertion, a regression that queries
    // the source program's ids instead — or drops the `in` filter and
    // counts every ParticipantApplication platform-wide — would still pass
    // all six tests unchanged, since participantApplication.count is a
    // fixed-return stub that ignores its `where` argument entirely.
    expect((tx as any).participantApplication.count).toHaveBeenCalledWith({
      where: { participationCategoryId: { in: ['t1'] } },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    // The whole point of the disjoint prisma/tx mock: prove the writes (and
    // the in-use guard's read) went through the transactional client, not
    // around it via the ambient this.prisma the copier also holds for reads.
    expect((prisma as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programParticipationCategory.create).not.toHaveBeenCalled();
    expect((prisma as any).participantApplication.count).not.toHaveBeenCalled();
  });

  it('replace refuses with ConflictException when existing categories are still referenced by applications', async () => {
    const { prisma, tx } = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 3,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    await expect(
      copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(ConflictException);
    // Same pin as the soft-delete test above: the guard must have been
    // asked about the target's ids ('t1'), not the source's ('s1'), before
    // it refused.
    expect((tx as any).participantApplication.count).toHaveBeenCalledWith({
      where: { participationCategoryId: { in: ['t1'] } },
    });
    expect((tx as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
    expect((tx as any).programParticipationCategory.create).not.toHaveBeenCalled();
  });

  it('append never runs the in-use guard even when existing categories are referenced', async () => {
    const { prisma, tx } = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 3,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('empty source is a no-op', async () => {
    const { prisma, tx } = mkPrisma({ sourceCategories: [], existingCategories: [category({ id: 't1', name: 'old' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
  });

  // Fix 1: description/benefits/eligibility are edited with Tiptap, which
  // can embed `<img src="...">` pointing at the source brand's storage.
  // preview() must flag this so the shared dialog's cross-brand warning
  // (which reads hasExternalMedia exclusively) actually fires here.
  it('preview() sets hasExternalMedia: true when any of description/benefits/eligibility embeds an <img>', async () => {
    const { prisma } = mkPrisma({
      sourceCategories: [
        category({ id: 's1', name: 'Plain', description: '<p>No media here</p>' }),
        category({ id: 's2', name: 'WithImage', benefits: '<p><img src="https://other-brand.example/x.png"></p>' }),
      ],
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 's1', label: 'Plain', meta: 'Active', hasExternalMedia: false },
      { id: 's2', label: 'WithImage', meta: 'Active', hasExternalMedia: true },
    ]);
  });
});

describe('ParticipationCategoriesCopier.exportTemplate', () => {
  it('exports the full category row shape', async () => {
    const { prisma } = mkPrisma({ sourceCategories: [category({ id: 's1', name: 'High School', description: '<p>desc</p>' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'participation-categories',
      payloadVersion: 1,
      items: [{ name: 'High School', description: '<p>desc</p>', benefits: null, eligibility: null, isActive: true }],
    });
  });

  it('honors itemIds', async () => {
    const { prisma } = mkPrisma({ sourceCategories: [category({ id: 's1', name: 'a' }), category({ id: 's2', name: 'b' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const payload = await copier.exportTemplate('src', ['s2']);
    expect(payload.items).toEqual([expect.objectContaining({ name: 'b' })]);
  });
});

describe('ParticipationCategoriesCopier.applyTemplate', () => {
  it('append inserts template categories and dedupes on name', async () => {
    const { prisma, tx } = mkPrisma({ existingCategories: [category({ id: 't1', name: 'High School' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'participation-categories',
        payloadVersion: 1,
        items: [
          { name: 'High School', description: null, benefits: null, eligibility: null, isActive: true },
          { name: 'University', description: null, benefits: null, eligibility: null, isActive: true },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace refuses with ConflictException when existing categories are still referenced by applications', async () => {
    const { prisma, tx } = mkPrisma({ existingCategories: [category({ id: 't1', name: 'old' })], referencingApplicationCount: 2 });
    const copier = new ParticipationCategoriesCopier(prisma);
    await expect(
      copier.applyTemplate(tx, { entityType: 'participation-categories', payloadVersion: 1, items: [{ name: 'a', description: null, benefits: null, eligibility: null, isActive: true }] }, 'tgt', 'replace'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((tx as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
    expect((tx as any).programParticipationCategory.create).not.toHaveBeenCalled();
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingCategories: [category({ id: 't1', name: 'old' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'participation-categories', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
  });
});

describe('ParticipationCategoriesCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the category on the target program', async () => {
    const { prisma, tx } = mkPrisma({ sourceCategories: [category({ id: 's1', name: 'High School', description: '<p>desc</p>', benefits: '<p>b</p>' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programParticipationCategory.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({ name: 'High School', description: '<p>desc</p>', benefits: '<p>b</p>' }));
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
