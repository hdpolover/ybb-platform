// services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts
import { ConflictException } from '@nestjs/common';
import { ParticipationCategoriesCopier } from './participation-categories.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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

function mkPrisma(opts: {
  sourceCategories?: CategoryRow[];
  existingCategories?: CategoryRow[];
  referencingApplicationCount?: number;
} = {}): PrismaService {
  const base: any = {
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
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('ParticipationCategoriesCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ParticipationCategoriesCopier(mkPrisma());
    expect(copier.key).toBe('participation-categories');
    expect(copier.label).toBe('Participation Categories');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new categories and dedupes on name', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'High School' }), category({ id: 's2', name: 'University' })],
      existingCategories: [category({ id: 't1', name: 'High School' })],
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing categories via deletedAt + isActive when none are referenced by applications', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 0,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programParticipationCategory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('replace refuses with ConflictException when existing categories are still referenced by applications', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 3,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((prisma as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programParticipationCategory.create).not.toHaveBeenCalled();
  });

  it('append never runs the in-use guard even when existing categories are referenced', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 3,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('empty source is a no-op', async () => {
    const prisma = mkPrisma({ sourceCategories: [], existingCategories: [category({ id: 't1', name: 'old' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
  });
});
