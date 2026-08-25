// services/api/src/modules/programs/application/copy/copiers/landing.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { LandingCopier } from './landing.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

type ProgramFixture = { landingContent: Record<string, unknown> | null };

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() read and
// write through. The brief's original spec passed one shared mock as both
// `prisma` and `tx`, which cannot distinguish "wrote through the
// transaction" from "wrote around it" — fixed here to match
// program-details.copier.spec.ts's pattern and this project's documented
// testing requirement.
function mkPrisma(programs: Record<string, ProgramFixture>) {
  const buildModels = () => ({
    program: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(programs[where.id] ?? null)),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

describe('LandingCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new LandingCopier(mkPrisma({}).prisma);
    expect(copier.key).toBe('landing');
    expect(copier.label).toBe('Landing Page Content');
    expect(copier.supportsAppend).toBe(false);
  });

  it('replace copies the whole landingContent object onto a target with no prior content', async () => {
    const { prisma, tx } = mkPrisma({
      src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] } },
      // tgt absent — findUnique('tgt') resolves null.
    });
    const copier = new LandingCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] } },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
    // Proves the write went through the transactional client, not around it.
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  it('replace reports replaced: 1 when the target already had landing content that got overwritten', async () => {
    const { prisma, tx } = mkPrisma({
      src: { landingContent: { promo_cta: { title: 'New' } } },
      tgt: { landingContent: { promo_cta: { title: 'Old' } } },
    });
    const copier = new LandingCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  // Defensive filter: PROGRAM_LANDING_CONTENT_KEYS is the allow-list
  // enforced by the update handler (Task 5), but this copier reads
  // landingContent straight off the row, not through that handler — a stray
  // key (e.g. from a bug, or a pre-allow-list backfill) must not propagate
  // to the target.
  it('drops any key outside the 7-key allow-list when copying, without erroring', async () => {
    const { prisma, tx } = mkPrisma({
      src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, not_a_real_key: 'stray' } },
    });
    const copier = new LandingCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] } } },
    });
  });

  it('rejects append mode', async () => {
    const { prisma, tx } = mkPrisma({ src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] } } } });
    const copier = new LandingCopier(prisma);
    await expect(
      copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  // Empty is the default state (Task 1's column default is '{}') and must
  // not be treated as an error to refuse copying FROM — this test is about
  // the guard specifically, using a source whose landingContent has zero
  // populated keys.
  it('rejects replace from a source with no populated keys (empty object)', async () => {
    const { prisma, tx } = mkPrisma({ src: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    await expect(
      copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  // A key present but structurally empty (empty array, empty object) counts
  // as no content, same as an absent key — mirrors the admin editor's own
  // "cleared this section" state (e.g. BenefitsSheet saving groups: []).
  it('treats a present-but-structurally-empty key as no content', async () => {
    const { prisma, tx } = mkPrisma({ src: { landingContent: { benefits: { eyebrow: '', title: '', groups: [] }, features: [] } } });
    const copier = new LandingCopier(prisma);
    await expect(
      copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replace proceeds when only one of the seven keys has content', async () => {
    const { prisma, tx } = mkPrisma({ src: { landingContent: { moments_shorts: { eyebrow: 'e', title: 't', description: 'd' } } } });
    const copier = new LandingCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { landingContent: { moments_shorts: { eyebrow: 'e', title: 't', description: 'd' } } },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  // Same reasoning as ContactCopier/ProgramDetailsCopier's equivalent test:
  // append mode is rejected outright, so the error must not tell the user
  // to try it.
  it('empty-source error message does not suggest the unsupported append mode', async () => {
    const { prisma, tx } = mkPrisma({ src: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    const err = await captureError(copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }));
    expect(err).toBeInstanceOf(BadRequestException);
    const response = err.getResponse() as { code: string; message: string };
    expect(response.code).toBe('empty_replace_source');
    expect(response.message).not.toMatch(/append/i);
  });

  it('preview() returns an empty array when the source has no populated keys', async () => {
    const { prisma } = mkPrisma({ src: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    expect(await copier.preview('src')).toEqual([]);
  });

  it('preview() returns one item describing how many of the seven keys have content, with hasExternalMedia always true when non-empty', async () => {
    const { prisma } = mkPrisma({
      src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, promo_cta: { title: 'x' } } },
    });
    const copier = new LandingCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 'src', label: 'Landing Page Sections', meta: '2 section(s) with content', hasExternalMedia: true }]);
  });

  it('countFor() returns 1 when any key has content, 0 when the program has none or does not exist', async () => {
    const { prisma } = mkPrisma({ src: { landingContent: { features: [{ id: 'f1' }] } } });
    const copier = new LandingCopier(prisma);
    expect(await copier.countFor('src')).toBe(1);
    expect(await copier.countFor('missing')).toBe(0);
  });

  it('countFor() returns 0 for a program whose landingContent is the column default ({})', async () => {
    const { prisma } = mkPrisma({ src: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    expect(await copier.countFor('src')).toBe(0);
  });
});

// exportTemplate/applyTemplate: required by ProgramCopier
// (program-copier.interface.ts) since Phase 2 — the brief's sample code for
// this copier predates that addition and omits both methods entirely,
// which would fail `implements ProgramCopier`. Added here to match the
// codebase, mirroring ProgramDetailsCopier's exportTemplate/applyTemplate
// shape (see that file and its spec). This also requires registering a
// 'landing' entry in template-payload.schemas.ts's TEMPLATE_ITEM_SCHEMAS —
// otherwise applyTemplate's parseTemplateItems call would throw
// unknown_template_entity_type unconditionally.
describe('LandingCopier.exportTemplate', () => {
  it('exports a single-item payload with the populated landingContent keys', async () => {
    const { prisma } = mkPrisma({ src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, promo_cta: { title: 'x' } } } });
    const copier = new LandingCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'landing',
      payloadVersion: 1,
      items: [{ benefits: { eyebrow: 'e', title: 't', groups: [] }, promo_cta: { title: 'x' } }],
    });
  });

  // Same defensive filter as copy(): a stray key outside the allow-list
  // must not be exported into the template payload.
  it('drops any key outside the 7-key allow-list when exporting', async () => {
    const { prisma } = mkPrisma({ src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, not_a_real_key: 'stray' } } });
    const copier = new LandingCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([{ benefits: { eyebrow: 'e', title: 't', groups: [] } }]);
  });
});

describe('LandingCopier.applyTemplate', () => {
  it("replace writes the template item's landingContent onto the target program", async () => {
    const { prisma, tx } = mkPrisma({ tgt: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      { entityType: 'landing', payloadVersion: 1, items: [{ moments_shorts: { eyebrow: 'e', title: 't', description: 'd' } }] },
      'tgt',
      'replace',
    );
    expect((tx as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { landingContent: { moments_shorts: { eyebrow: 'e', title: 't', description: 'd' } } },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  it('rejects append mode', async () => {
    const { prisma, tx } = mkPrisma({});
    const copier = new LandingCopier(prisma);
    await expect(
      copier.applyTemplate(tx, { entityType: 'landing', payloadVersion: 1, items: [{ promo_cta: { title: 'x' } }] }, 'tgt', 'append'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  it('rejects a template whose single item has no populated keys, before any mutation', async () => {
    const { prisma, tx } = mkPrisma({});
    const copier = new LandingCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'landing', payloadVersion: 1, items: [{}] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  it('rejects a template item carrying a field the schema has no slot for', async () => {
    const { tx } = mkPrisma({});
    const copier = new LandingCopier({} as PrismaService);
    await expect(
      copier.applyTemplate(
        tx,
        { entityType: 'landing', payloadVersion: 1, items: [{ promo_cta: { title: 'x' }, unexpectedField: 'nope' }] },
        'tgt',
        'replace',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });
});
