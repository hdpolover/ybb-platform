// services/api/src/modules/programs/application/copy/copiers/photos.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { PhotosCopier } from './photos.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

// Mirrors testimonials.copier.spec.ts's helper: BadRequestException here
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

type PhotoRow = {
  id: string;
  imageUrl: string;
  videoUrl: string | null;
  title: string | null;
  description: string | null;
  year: number | null;
  type: string;
  order: number;
  isActive: boolean;
};

function photo(over: Partial<PhotoRow>): PhotoRow {
  return {
    id: 'p1',
    imageUrl: 'https://cdn.example.com/a.jpg',
    videoUrl: null,
    title: 'Opening Ceremony',
    description: null,
    year: 2026,
    type: 'image',
    order: 0,
    isActive: true,
    ...over,
  };
}

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() read and
// write through. Both model mocks share the same fixture-backed behavior,
// but are independently-tracked jest.fn() sets so a write that escaped the
// transaction onto `prisma` instead of `tx` is visible to assertions.
function mkPrisma(opts: { sourceItems?: PhotoRow[]; existingItems?: PhotoRow[] } = {}) {
  const buildModels = () => ({
    programGallery: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceItems : opts.existingItems)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.imageUrl}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('PhotosCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new PhotosCopier(mkPrisma().prisma);
    expect(copier.key).toBe('photos');
    expect(copier.label).toBe('Photos');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append dedupes on imageUrl', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        photo({ id: 's1', imageUrl: 'https://cdn.example.com/a.jpg' }),
        photo({ id: 's2', imageUrl: 'https://cdn.example.com/b.jpg' }),
      ],
      existingItems: [photo({ id: 't1', imageUrl: 'https://cdn.example.com/a.jpg' })],
    });
    const copier = new PhotosCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing photos then inserts from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [photo({ id: 's1', imageUrl: 'https://cdn.example.com/new.jpg', order: 3 })],
      existingItems: [photo({ id: 't1', imageUrl: 'https://cdn.example.com/old.jpg' })],
    });
    const copier = new PhotosCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programGallery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (tx as any).programGallery.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    expect((prisma as any).programGallery.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programGallery.create).not.toHaveBeenCalled();
  });

  it('copies image/video/metadata fields verbatim', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        photo({
          id: 's1',
          imageUrl: 'https://cdn.example.com/a.jpg',
          videoUrl: 'https://cdn.example.com/a.mp4',
          title: 'Closing Night',
          description: 'The final gathering.',
          year: 2025,
          type: 'video',
        }),
      ],
    });
    const copier = new PhotosCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).programGallery.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        imageUrl: 'https://cdn.example.com/a.jpg',
        videoUrl: 'https://cdn.example.com/a.mp4',
        title: 'Closing Night',
        description: 'The final gathering.',
        year: 2025,
        type: 'video',
      }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with year as meta and hasExternalMedia always true (imageUrl is required)', async () => {
    const { prisma } = mkPrisma({
      sourceItems: [
        photo({ id: 's1', title: 'Opening', year: 2026, imageUrl: 'https://cdn.example.com/a.jpg' }),
        photo({ id: 's2', title: null, year: null, imageUrl: 'https://cdn.example.com/b.jpg' }),
      ],
    });
    const copier = new PhotosCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 's1', label: 'Opening', meta: '2026', hasExternalMedia: true },
      { id: 's2', label: 'https://cdn.example.com/b.jpg', meta: undefined, hasExternalMedia: true },
    ]);
  });
});

describe('PhotosCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const { prisma } = mkPrisma({ sourceItems: [photo({ id: 's1', imageUrl: 'https://cdn.example.com/a.jpg', title: 'Opening' })] });
    const copier = new PhotosCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([expect.objectContaining({ imageUrl: 'https://cdn.example.com/a.jpg', title: 'Opening' })]);
  });
});

describe('PhotosCopier.applyTemplate', () => {
  it('dedupes on imageUrl', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [photo({ id: 't1', imageUrl: 'https://cdn.example.com/a.jpg' })] });
    const copier = new PhotosCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'photos',
        payloadVersion: 1,
        items: [
          { imageUrl: 'https://cdn.example.com/a.jpg', videoUrl: null, title: 'Dup', description: null, year: 2026, type: 'image', isActive: true },
          { imageUrl: 'https://cdn.example.com/c.jpg', videoUrl: null, title: 'New', description: null, year: 2026, type: 'image', isActive: true },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [photo({ id: 't1', imageUrl: 'https://cdn.example.com/old.jpg' })] });
    const copier = new PhotosCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'photos', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programGallery.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programGallery.updateMany).not.toHaveBeenCalled();
  });
});

describe('PhotosCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the photo on the target program', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [photo({ id: 's1', imageUrl: 'https://cdn.example.com/a.jpg', title: 'Opening', year: 2026 })],
    });
    const copier = new PhotosCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programGallery.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ imageUrl: 'https://cdn.example.com/a.jpg', title: 'Opening', year: 2026 }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
