// services/api/src/modules/programs/application/copy/copiers/faqs.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { FaqsCopier } from './faqs.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
};

function faq(over: Partial<FaqRow>): FaqRow {
  return {
    id: over.id ?? 'q1',
    question: over.question ?? 'How do I apply?',
    answer: over.answer ?? 'Fill out the form.',
    category: over.category ?? 'general',
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

function mkPrisma(opts: { sourceItems?: FaqRow[]; existingItems?: FaqRow[] } = {}): PrismaService {
  const base: any = {
    programFaq: {
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
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.question}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('FaqsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new FaqsCopier(mkPrisma());
    expect(copier.key).toBe('faqs');
    expect(copier.label).toBe('FAQs');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new FAQs and dedupes on question', async () => {
    const prisma = mkPrisma({
      sourceItems: [faq({ id: 's1', question: 'How do I apply?' }), faq({ id: 's2', question: 'When is the deadline?' })],
      existingItems: [faq({ id: 't1', question: 'How do I apply?' })],
    });
    const copier = new FaqsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing FAQs then inserts from order 0', async () => {
    const prisma = mkPrisma({
      sourceItems: [faq({ id: 's1', question: 'a', order: 3 })],
      existingItems: [faq({ id: 't1', question: 'old' })],
    });
    const copier = new FaqsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programFaq.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (prisma as any).programFaq.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('copies answer and category verbatim', async () => {
    const prisma = mkPrisma({
      sourceItems: [faq({ id: 's1', question: 'Refund policy?', answer: 'Non-refundable after acceptance.', category: 'payment' })],
    });
    const copier = new FaqsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programFaq.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ answer: 'Non-refundable after acceptance.', category: 'payment' }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with category as meta', async () => {
    const prisma = mkPrisma({ sourceItems: [faq({ id: 's1', question: 'How do I apply?', category: 'registration' })] });
    const copier = new FaqsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'How do I apply?', meta: 'registration' }]);
  });
});

describe('FaqsCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const prisma = mkPrisma({ sourceItems: [faq({ id: 's1', question: 'Q?', answer: 'A.', category: 'general' })] });
    const copier = new FaqsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({ entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }] });
  });
});

describe('FaqsCopier.applyTemplate', () => {
  it('append inserts and dedupes on question', async () => {
    const prisma = mkPrisma({ existingItems: [faq({ id: 't1', question: 'Existing?' })] });
    const copier = new FaqsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      {
        entityType: 'faqs',
        payloadVersion: 1,
        items: [
          { question: 'Existing?', answer: 'A.', category: 'general', isActive: true },
          { question: 'New?', answer: 'A2.', category: 'general', isActive: true },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const prisma = mkPrisma({ existingItems: [faq({ id: 't1', question: 'old?' })] });
    const copier = new FaqsCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(prisma, { entityType: 'faqs', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((prisma as any).programFaq.updateMany).not.toHaveBeenCalled();
  });
});

describe('FaqsCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the FAQ on the target program', async () => {
    const prisma = mkPrisma({ sourceItems: [faq({ id: 's1', question: 'Refund policy?', answer: 'Non-refundable.', category: 'payment' })] });
    const copier = new FaqsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(prisma, payload, 'tgt', 'append');
    const create = (prisma as any).programFaq.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({ question: 'Refund policy?', answer: 'Non-refundable.', category: 'payment' }));
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
