// services/api/src/modules/programs/application/copy/copiers/testimonials.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { TestimonialsCopier } from './testimonials.copier';
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

type TestimonialRow = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  testimonial: string;
  category: string;
  type: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  avatarUrl: string | null;
  rating: number | null;
  alumniYear: number | null;
  isFeatured: boolean;
  order: number;
  isActive: boolean;
};

function testimonial(over: Partial<TestimonialRow>): TestimonialRow {
  return {
    id: over.id ?? 't1',
    name: over.name ?? 'Jane Doe',
    role: over.role ?? 'Alumni 2024',
    company: over.company ?? null,
    testimonial: over.testimonial ?? 'This program changed my life.',
    category: over.category ?? 'alumni',
    type: over.type ?? 'text',
    videoUrl: over.videoUrl ?? null,
    thumbnailUrl: over.thumbnailUrl ?? null,
    avatarUrl: over.avatarUrl ?? null,
    rating: over.rating ?? null,
    alumniYear: over.alumniYear ?? null,
    isFeatured: over.isFeatured ?? false,
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() read and
// write through. Both model mocks share the same fixture-backed behavior,
// but are independently-tracked jest.fn() sets so a write that escaped the
// transaction onto `prisma` instead of `tx` is visible to assertions.
function mkPrisma(opts: { sourceItems?: TestimonialRow[]; existingItems?: TestimonialRow[] } = {}) {
  const buildModels = () => ({
    programTestimonial: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceItems : opts.existingItems)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}-${data.type}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('TestimonialsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new TestimonialsCopier(mkPrisma().prisma);
    expect(copier.key).toBe('testimonials');
    expect(copier.label).toBe('Testimonials');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append dedupes on the (name, type) composite, not name alone (a text and video testimonial from the same person both copy)', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        testimonial({ id: 's1', name: 'Jane Doe', type: 'text' }),
        testimonial({ id: 's2', name: 'Jane Doe', type: 'video' }),
      ],
      existingItems: [testimonial({ id: 't1', name: 'Jane Doe', type: 'text' })],
    });
    const copier = new TestimonialsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // The text testimonial collides with the existing one; the video
    // testimonial from the same person does not.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing testimonials then inserts from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [testimonial({ id: 's1', name: 'New Person', order: 3 })],
      existingItems: [testimonial({ id: 't1', name: 'Old Person' })],
    });
    const copier = new TestimonialsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programTestimonial.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (tx as any).programTestimonial.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    expect((prisma as any).programTestimonial.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programTestimonial.create).not.toHaveBeenCalled();
  });

  it('copies testimonial text, category, and video fields verbatim', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        testimonial({
          id: 's1',
          name: 'Jane Doe',
          testimonial: 'Life-changing experience.',
          category: 'speaker',
          type: 'video',
          videoUrl: 'https://cdn.example.com/jane.mp4',
          thumbnailUrl: 'https://cdn.example.com/jane-thumb.jpg',
        }),
      ],
    });
    const copier = new TestimonialsCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).programTestimonial.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        testimonial: 'Life-changing experience.',
        category: 'speaker',
        type: 'video',
        videoUrl: 'https://cdn.example.com/jane.mp4',
        thumbnailUrl: 'https://cdn.example.com/jane-thumb.jpg',
      }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with type as meta and hasExternalMedia from avatar/video/thumbnail', async () => {
    const { prisma } = mkPrisma({
      sourceItems: [
        testimonial({ id: 's1', name: 'Jane Doe', type: 'text', avatarUrl: 'https://cdn.example.com/jane.jpg' }),
        testimonial({ id: 's2', name: 'John Smith', type: 'video', videoUrl: 'https://cdn.example.com/john.mp4' }),
        testimonial({ id: 's3', name: 'Plain Person', type: 'text' }),
      ],
    });
    const copier = new TestimonialsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 's1', label: 'Jane Doe', meta: 'text', hasExternalMedia: true },
      { id: 's2', label: 'John Smith', meta: 'video', hasExternalMedia: true },
      { id: 's3', label: 'Plain Person', meta: 'text', hasExternalMedia: false },
    ]);
  });
});

describe('TestimonialsCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const { prisma } = mkPrisma({ sourceItems: [testimonial({ id: 's1', name: 'Jane Doe', testimonial: 'Great!' })] });
    const copier = new TestimonialsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([expect.objectContaining({ name: 'Jane Doe', testimonial: 'Great!' })]);
  });
});

describe('TestimonialsCopier.applyTemplate', () => {
  it('dedupes on the composite (name, type), not on name alone', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [testimonial({ id: 't1', name: 'Jane Doe', type: 'text' })] });
    const copier = new TestimonialsCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'testimonials',
        payloadVersion: 1,
        items: [
          {
            name: 'Jane Doe', role: null, company: null, testimonial: 'Text version.', category: 'alumni', type: 'text',
            videoUrl: null, thumbnailUrl: null, avatarUrl: null, rating: null, alumniYear: null, isFeatured: false, isActive: true,
          },
          {
            name: 'Jane Doe', role: null, company: null, testimonial: 'Video version.', category: 'alumni', type: 'video',
            videoUrl: 'https://cdn.example.com/jane.mp4', thumbnailUrl: null, avatarUrl: null, rating: null, alumniYear: null,
            isFeatured: false, isActive: true,
          },
        ],
      },
      'tgt',
      'append',
    );
    // Same name, different type — not a collision.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [testimonial({ id: 't1', name: 'old' })] });
    const copier = new TestimonialsCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'testimonials', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programTestimonial.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programTestimonial.updateMany).not.toHaveBeenCalled();
  });
});

describe('TestimonialsCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the testimonial on the target program', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [testimonial({ id: 's1', name: 'Jane Doe', testimonial: 'Amazing.', category: 'mentor', type: 'text' })],
    });
    const copier = new TestimonialsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programTestimonial.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'Jane Doe', testimonial: 'Amazing.', category: 'mentor' }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
