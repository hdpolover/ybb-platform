// services/api/src/modules/programs/application/copy/copiers/sub-themes.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { SubThemesCopier } from './sub-themes.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

// Mirrors faqs.copier.spec.ts's helper: BadRequestException here carries a
// structured { code, message } response body, and Nest's HttpException
// surfaces that body's own `message` string as the thrown error's
// `.message` — not the `code` — so `.rejects.toThrow(/code/)` can never
// match. Asserting on `.getResponse().code` is this codebase's established
// way to check a structured exception's code.
async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

type SubThemeRow = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
};

function subTheme(over: Partial<SubThemeRow>): SubThemeRow {
  return {
    id: over.id ?? 's1',
    name: over.name ?? 'Climate Action',
    description: over.description ?? null,
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

// Builds a disjoint `{ prisma, tx }` pair — see faqs.copier.spec.ts for the
// rationale (proves writes go through the transactional client, not the
// ambient this.prisma the copier also holds for reads).
function mkPrisma(opts: { sourceItems?: SubThemeRow[]; existingItems?: SubThemeRow[] } = {}) {
  const buildModels = () => ({
    programSubtheme: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceItems : opts.existingItems)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('SubThemesCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new SubThemesCopier(mkPrisma().prisma);
    expect(copier.key).toBe('sub-themes');
    expect(copier.label).toBe('Sub Themes');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new sub themes and dedupes on name', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [subTheme({ id: 's1', name: 'Climate Action' }), subTheme({ id: 's2', name: 'Digital Rights' })],
      existingItems: [subTheme({ id: 't1', name: 'Climate Action' })],
    });
    const copier = new SubThemesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing sub themes then inserts from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [subTheme({ id: 's1', name: 'a', order: 3 })],
      existingItems: [subTheme({ id: 't1', name: 'old' })],
    });
    const copier = new SubThemesCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programSubtheme.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (tx as any).programSubtheme.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    expect((prisma as any).programSubtheme.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programSubtheme.create).not.toHaveBeenCalled();
  });

  it('copies description verbatim', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [subTheme({ id: 's1', name: 'Ocean Conservation', description: 'Protecting marine ecosystems.' })],
    });
    const copier = new SubThemesCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).programSubtheme.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ description: 'Protecting marine ecosystems.' }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with active status as meta', async () => {
    const { prisma } = mkPrisma({ sourceItems: [subTheme({ id: 's1', name: 'Climate Action', isActive: false })] });
    const copier = new SubThemesCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Climate Action', meta: 'Inactive' }]);
  });
});

describe('SubThemesCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const { prisma } = mkPrisma({ sourceItems: [subTheme({ id: 's1', name: 'Climate Action', description: 'Envt.' })] });
    const copier = new SubThemesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'sub-themes',
      payloadVersion: 1,
      items: [{ name: 'Climate Action', description: 'Envt.', isActive: true }],
    });
  });
});

describe('SubThemesCopier.applyTemplate', () => {
  it('append inserts and dedupes on name', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [subTheme({ id: 't1', name: 'Existing' })] });
    const copier = new SubThemesCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'sub-themes',
        payloadVersion: 1,
        items: [
          { name: 'Existing', description: null, isActive: true },
          { name: 'New', description: null, isActive: true },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [subTheme({ id: 't1', name: 'old' })] });
    const copier = new SubThemesCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'sub-themes', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programSubtheme.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programSubtheme.updateMany).not.toHaveBeenCalled();
  });
});

describe('SubThemesCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the sub theme on the target program', async () => {
    const { prisma, tx } = mkPrisma({ sourceItems: [subTheme({ id: 's1', name: 'Ocean Conservation', description: 'Marine.' })] });
    const copier = new SubThemesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programSubtheme.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({ name: 'Ocean Conservation', description: 'Marine.' }));
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
