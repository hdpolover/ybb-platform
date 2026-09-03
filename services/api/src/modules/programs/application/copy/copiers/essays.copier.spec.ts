// services/api/src/modules/programs/application/copy/copiers/essays.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { EssaysCopier } from './essays.copier';
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

type EssayRow = {
  id: string;
  question: string;
  description: string | null;
  wordLimit: number | null;
  isRequired: boolean;
  order: number;
  isActive: boolean;
  allowedCategories: string[];
};

function essay(over: Partial<EssayRow>): EssayRow {
  return {
    id: over.id ?? 'e1',
    question: over.question ?? 'Why do you want to join?',
    description: over.description ?? null,
    wordLimit: over.wordLimit ?? 500,
    isRequired: over.isRequired ?? true,
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
    allowedCategories: over.allowedCategories ?? [],
  };
}

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() read and
// write through. Both model mocks share the same fixture-backed behavior,
// but are independently-tracked jest.fn() sets so a write that escaped the
// transaction onto `prisma` instead of `tx` is visible to assertions.
function mkPrisma(opts: { sourceItems?: EssayRow[]; existingItems?: EssayRow[] } = {}) {
  const buildModels = () => ({
    programEssay: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      // Mirrors real Prisma updateMany: count reflects the rows actually
      // matched by the where clause (the target's existing rows here), not
      // a fixed stub — otherwise the replace-mode `replaced` assertion below
      // could never be satisfied by any implementation.
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceItems : opts.existingItems)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.question}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('EssaysCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new EssaysCopier(mkPrisma().prisma);
    expect(copier.key).toBe('essays');
    expect(copier.label).toBe('Essays');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new essays and dedupes on question', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [essay({ id: 's1', question: 'Why do you want to join?' }), essay({ id: 's2', question: 'Describe a challenge you overcame.' })],
      existingItems: [essay({ id: 't1', question: 'Why do you want to join?' })],
    });
    const copier = new EssaysCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing essays then inserts from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [essay({ id: 's1', question: 'a', order: 3 })],
      existingItems: [essay({ id: 't1', question: 'old' })],
    });
    const copier = new EssaysCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programEssay.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (tx as any).programEssay.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    // The whole point of the disjoint prisma/tx mock: prove the writes went
    // through the transactional client, not around it via the ambient
    // this.prisma the copier also holds for reads.
    expect((prisma as any).programEssay.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programEssay.create).not.toHaveBeenCalled();
  });

  it('carries allowedCategories verbatim through copy()', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [essay({ id: 's1', question: 'Scholarship essay', allowedCategories: ['fully_funded'] })],
    });
    const copier = new EssaysCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).programEssay.create as jest.Mock;
    expect(create.mock.calls[0][0].data.allowedCategories).toEqual(['fully_funded']);
  });

  it('preview() maps rows to CopyPreviewItem with required/optional as meta', async () => {
    const { prisma } = mkPrisma({ sourceItems: [essay({ id: 's1', question: 'Why do you want to join?', isRequired: false })] });
    const copier = new EssaysCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Why do you want to join?', meta: 'Optional' }]);
  });
});

describe('EssaysCopier.exportTemplate', () => {
  it('exports the full row shape, including allowedCategories', async () => {
    const { prisma } = mkPrisma({
      sourceItems: [essay({ id: 's1', question: 'Q?', description: 'Some context', wordLimit: 300, allowedCategories: ['self_funded'] })],
    });
    const copier = new EssaysCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'essays',
      payloadVersion: 1,
      items: [{ question: 'Q?', description: 'Some context', wordLimit: 300, isRequired: true, isActive: true, allowedCategories: ['self_funded'] }],
    });
  });
});

describe('EssaysCopier.applyTemplate', () => {
  it('append inserts and dedupes on question', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [essay({ id: 't1', question: 'Existing?' })] });
    const copier = new EssaysCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'essays',
        payloadVersion: 1,
        items: [
          { question: 'Existing?', description: null, wordLimit: null, isRequired: true, isActive: true, allowedCategories: [] },
          { question: 'New?', description: null, wordLimit: null, isRequired: true, isActive: true, allowedCategories: ['fully_funded'] },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
    const create = (tx as any).programEssay.create as jest.Mock;
    expect(create.mock.calls[0][0].data.allowedCategories).toEqual(['fully_funded']);
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [essay({ id: 't1', question: 'old?' })] });
    const copier = new EssaysCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'essays', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programEssay.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programEssay.updateMany).not.toHaveBeenCalled();
  });
});

describe('EssaysCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the essay on the target program, including allowedCategories', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [essay({ id: 's1', question: 'Refund policy?', description: 'Explain.', allowedCategories: ['fully_funded'] })],
    });
    const copier = new EssaysCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programEssay.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ question: 'Refund policy?', description: 'Explain.', allowedCategories: ['fully_funded'] }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
