// services/api/src/modules/programs/application/copy/copiers/speakers.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { SpeakersCopier } from './speakers.copier';
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

type SpeakerRow = {
  id: string;
  name: string;
  title: string | null;
  organization: string | null;
  bio: string | null;
  photoUrl: string | null;
  email: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  sessionTitle: string | null;
  sessionDescription: string | null;
  sessionTime: Date | null;
  isKeynote: boolean;
  expertiseAreas: string | null;
  order: number;
  isActive: boolean;
};

function speaker(over: Partial<SpeakerRow>): SpeakerRow {
  return {
    id: over.id ?? 'sp1',
    name: over.name ?? 'Jane Doe',
    title: over.title ?? 'CEO',
    // 'organization' in over (not ??) so a test can explicitly override to
    // null without falling back to the default — null is nullish too.
    organization: 'organization' in over ? over.organization! : 'Acme Inc',
    bio: over.bio ?? null,
    photoUrl: over.photoUrl ?? null,
    email: over.email ?? null,
    linkedinUrl: over.linkedinUrl ?? null,
    twitterUrl: over.twitterUrl ?? null,
    instagramUrl: over.instagramUrl ?? null,
    sessionTitle: over.sessionTitle ?? null,
    sessionDescription: over.sessionDescription ?? null,
    sessionTime: over.sessionTime ?? null,
    isKeynote: over.isKeynote ?? false,
    expertiseAreas: over.expertiseAreas ?? null,
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
function mkPrisma(opts: { sourceItems?: SpeakerRow[]; existingItems?: SpeakerRow[] } = {}) {
  const buildModels = () => ({
    programSpeaker: {
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

describe('SpeakersCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new SpeakersCopier(mkPrisma().prisma);
    expect(copier.key).toBe('speakers');
    expect(copier.label).toBe('Speakers');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new speakers and dedupes on name', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [speaker({ id: 's1', name: 'Jane Doe' }), speaker({ id: 's2', name: 'John Smith' })],
      existingItems: [speaker({ id: 't1', name: 'Jane Doe' })],
    });
    const copier = new SpeakersCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing speakers then inserts from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [speaker({ id: 's1', name: 'New Speaker', order: 3 })],
      existingItems: [speaker({ id: 't1', name: 'Old Speaker' })],
    });
    const copier = new SpeakersCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).programSpeaker.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (tx as any).programSpeaker.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
    expect((prisma as any).programSpeaker.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programSpeaker.create).not.toHaveBeenCalled();
  });

  it('copies bio, photoUrl, and session fields verbatim', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [
        speaker({
          id: 's1',
          name: 'Jane Doe',
          bio: 'A great leader.',
          photoUrl: 'https://cdn.example.com/jane.jpg',
          sessionTitle: 'The Future of Work',
          isKeynote: true,
        }),
      ],
    });
    const copier = new SpeakersCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).programSpeaker.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        bio: 'A great leader.',
        photoUrl: 'https://cdn.example.com/jane.jpg',
        sessionTitle: 'The Future of Work',
        isKeynote: true,
      }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with organization as meta and hasExternalMedia from photoUrl', async () => {
    const { prisma } = mkPrisma({
      sourceItems: [
        speaker({ id: 's1', name: 'Jane Doe', organization: 'Acme Inc', photoUrl: 'https://cdn.example.com/jane.jpg' }),
        speaker({ id: 's2', name: 'John Smith', organization: null, title: 'CTO', photoUrl: null }),
      ],
    });
    const copier = new SpeakersCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 's1', label: 'Jane Doe', meta: 'Acme Inc', hasExternalMedia: true },
      { id: 's2', label: 'John Smith', meta: 'CTO', hasExternalMedia: false },
    ]);
  });
});

describe('SpeakersCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const { prisma } = mkPrisma({ sourceItems: [speaker({ id: 's1', name: 'Jane Doe', bio: 'Bio text.' })] });
    const copier = new SpeakersCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([expect.objectContaining({ name: 'Jane Doe', bio: 'Bio text.' })]);
  });
});

describe('SpeakersCopier.applyTemplate', () => {
  it('append inserts and dedupes on name', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [speaker({ id: 't1', name: 'Existing Speaker' })] });
    const copier = new SpeakersCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      {
        entityType: 'speakers',
        payloadVersion: 1,
        items: [
          {
            name: 'Existing Speaker', title: null, organization: null, bio: null, photoUrl: null, email: null,
            linkedinUrl: null, twitterUrl: null, instagramUrl: null, sessionTitle: null, sessionDescription: null,
            sessionTime: null, isKeynote: false, expertiseAreas: null, isActive: true,
          },
          {
            name: 'New Speaker', title: null, organization: null, bio: null, photoUrl: null, email: null,
            linkedinUrl: null, twitterUrl: null, instagramUrl: null, sessionTitle: null, sessionDescription: null,
            sessionTime: null, isKeynote: false, expertiseAreas: null, isActive: true,
          },
        ],
      },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrisma({ existingItems: [speaker({ id: 't1', name: 'old' })] });
    const copier = new SpeakersCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'speakers', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).programSpeaker.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programSpeaker.updateMany).not.toHaveBeenCalled();
  });
});

describe('SpeakersCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the speaker on the target program', async () => {
    const { prisma, tx } = mkPrisma({
      sourceItems: [speaker({ id: 's1', name: 'Jane Doe', sessionTitle: 'Keynote', sessionTime: new Date('2026-01-01T09:00:00.000Z') })],
    });
    const copier = new SpeakersCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).programSpeaker.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'Jane Doe', sessionTitle: 'Keynote', sessionTime: new Date('2026-01-01T09:00:00.000Z') }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
