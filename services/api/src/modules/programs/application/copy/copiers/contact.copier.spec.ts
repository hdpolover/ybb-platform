// services/api/src/modules/programs/application/copy/copiers/contact.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ContactCopier } from './contact.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

type ProgramFixture = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactAddress: string | null;
};

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

describe('ContactCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ContactCopier(mkPrisma({}).prisma);
    expect(copier.key).toBe('contact');
    expect(copier.label).toBe('Contact Information');
    expect(copier.supportsAppend).toBe(false);
  });

  it('replace copies all four fields onto a target with no prior content', async () => {
    const { prisma, tx } = mkPrisma({
      src: { contactEmail: 'hello@example.com', contactPhone: '+62811', contactWhatsapp: '62811', contactAddress: 'Jakarta' },
      // tgt intentionally absent — findUnique('tgt') resolves null, so the
      // target starts with nothing to overwrite.
    });
    const copier = new ContactCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { contactEmail: 'hello@example.com', contactPhone: '+62811', contactWhatsapp: '62811', contactAddress: 'Jakarta' },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
    // Proves the write went through the transactional client, not around it.
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  it('replace reports replaced: 1 when the target already had contact info that got overwritten', async () => {
    const { prisma, tx } = mkPrisma({
      src: { contactEmail: 'new@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
      tgt: { contactEmail: 'old@example.com', contactPhone: '+62800', contactWhatsapp: null, contactAddress: null },
    });
    const copier = new ContactCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('rejects append mode', async () => {
    const { prisma, tx } = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    await expect(
      copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  // Data-loss guard, same shape as ProgramDetailsCopier's: a source with no
  // content in any of the four fields would overwrite the target's populated
  // contact info with four blanks. Mixes null/whitespace/'' to prove all
  // three count as "no content".
  it('rejects replace from a source with no contact info in any of the four fields', async () => {
    const { prisma, tx } = mkPrisma({ src: { contactEmail: null, contactPhone: '   ', contactWhatsapp: null, contactAddress: '' } });
    const copier = new ContactCopier(prisma);
    await expect(
      copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  it('replace proceeds when only one of the four fields has content, blanking the other three on the target', async () => {
    const { prisma, tx } = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  // The error message must advise something the user can actually do — same
  // reasoning as ProgramDetailsCopier's equivalent test: append mode is
  // rejected outright, so telling the user to "use append mode instead"
  // would be impossible advice.
  it('empty-source error message does not suggest the unsupported append mode', async () => {
    const { prisma, tx } = mkPrisma({ src: { contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    const err = await captureError(copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }));
    expect(err).toBeInstanceOf(BadRequestException);
    const response = err.getResponse() as { code: string; message: string };
    expect(response.code).toBe('empty_replace_source');
    expect(response.message).not.toMatch(/append/i);
  });

  it('preview() returns an empty array when the source program has no contact info', async () => {
    const { prisma } = mkPrisma({ src: { contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    expect(await copier.preview('src')).toEqual([]);
  });

  // Plain strings, not markup — preview() must never set hasExternalMedia
  // for this copier (contrast with ProgramDetailsCopier, which does).
  it('preview() returns one item describing how many of the four fields have content, and never sets hasExternalMedia', async () => {
    const { prisma } = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: '+62811', contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 'src', label: 'Contact Information', meta: '2 field(s) with content' }]);
    expect(items[0].hasExternalMedia).toBeUndefined();
  });

  it('countFor() returns 1 when any field has content, 0 when the program has none or does not exist', async () => {
    const { prisma } = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    expect(await copier.countFor('src')).toBe(1);
    expect(await copier.countFor('missing')).toBe(0);
  });
});

// exportTemplate/applyTemplate: required by ProgramCopier
// (program-copier.interface.ts) since Phase 2 — the brief's sample code for
// this copier predates that addition and omits both methods entirely,
// which would fail `implements ProgramCopier`. Added here to match the
// codebase, mirroring ProgramDetailsCopier's exportTemplate/applyTemplate
// shape (see that file and its spec).
describe('ContactCopier.exportTemplate', () => {
  it('exports a single-item payload with the four scalar fields', async () => {
    const { prisma } = mkPrisma({ src: { contactEmail: 'hello@example.com', contactPhone: '+62811', contactWhatsapp: null, contactAddress: 'Jakarta' } });
    const copier = new ContactCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'contact',
      payloadVersion: 1,
      items: [{ contactEmail: 'hello@example.com', contactPhone: '+62811', contactWhatsapp: null, contactAddress: 'Jakarta' }],
    });
  });
});

describe('ContactCopier.applyTemplate', () => {
  it("replace writes the template item's four fields onto the target program", async () => {
    const { prisma, tx } = mkPrisma({ tgt: { contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      { entityType: 'contact', payloadVersion: 1, items: [{ contactEmail: 'x@example.com', contactPhone: '+62811', contactWhatsapp: null, contactAddress: null }] },
      'tgt',
      'replace',
    );
    expect((tx as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { contactEmail: 'x@example.com', contactPhone: '+62811', contactWhatsapp: null, contactAddress: null },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  it('rejects append mode', async () => {
    const { prisma, tx } = mkPrisma({});
    const copier = new ContactCopier(prisma);
    await expect(
      copier.applyTemplate(tx, { entityType: 'contact', payloadVersion: 1, items: [{ contactEmail: 'x', contactPhone: null, contactWhatsapp: null, contactAddress: null }] }, 'tgt', 'append'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  it('rejects a template whose single item is blank in all four fields, before any mutation', async () => {
    const { prisma, tx } = mkPrisma({});
    const copier = new ContactCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'contact', payloadVersion: 1, items: [{ contactEmail: null, contactPhone: '   ', contactWhatsapp: null, contactAddress: '' }] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });

  it('rejects a template item carrying a field the schema has no slot for', async () => {
    const { tx } = mkPrisma({});
    const copier = new ContactCopier({} as PrismaService);
    await expect(
      copier.applyTemplate(
        tx,
        { entityType: 'contact', payloadVersion: 1, items: [{ contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null, unexpectedField: 'nope' }] },
        'tgt',
        'replace',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((tx as any).program.update).not.toHaveBeenCalled();
  });
});
