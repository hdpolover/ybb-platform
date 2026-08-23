// services/api/src/modules/programs/application/copy/copiers/program-details.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ProgramDetailsCopier } from './program-details.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(programs: Record<string, { requirementsDescription: string | null; benefitsDescription: string | null; termsAndConditions: string | null }>): PrismaService {
  const base: any = {
    program: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(programs[where.id] ?? null)),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('ProgramDetailsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ProgramDetailsCopier(mkPrisma({}));
    expect(copier.key).toBe('program-details');
    expect(copier.label).toBe('Participant-Facing Content');
    expect(copier.supportsAppend).toBe(false);
  });

  it('replace copies all three scalar fields from the source onto the target', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '<p>Bring a laptop</p>', benefitsDescription: '<p>Certificate</p>', termsAndConditions: '<p>No refunds</p>' },
    });
    const copier = new ProgramDetailsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: {
        requirementsDescription: '<p>Bring a laptop</p>',
        benefitsDescription: '<p>Certificate</p>',
        termsAndConditions: '<p>No refunds</p>',
      },
    });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 1 });
  });

  it('rejects append mode', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: 'x', benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // Data-loss guard: analogous to every row-based copier's
  // replace-from-empty-source guard (copy-scoped-rows.ts, payments.copier.ts).
  // A source whose three fields are all null/empty carries no content to
  // copy, so replacing the target with it would silently wipe existing
  // participant-facing text with nothing to show for it. Mixes null and ''
  // to prove both count as "no content", matching contentFieldCount's
  // Boolean() filter used by preview()/countFor().
  it('rejects replace from a source with no content in any of the three fields', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: null, benefitsDescription: '', termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // Partial content is not the destructive all-empty case: a source with
  // even one populated field is a legitimate replace, including nulling out
  // the other two on the target (ordinary replace semantics, not data loss).
  it('replace proceeds when only one of the three fields has content', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>Bring ID</p>', benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: {
        requirementsDescription: '<p>Bring ID</p>',
        benefitsDescription: null,
        termsAndConditions: null,
      },
    });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 1 });
  });

  it('preview() returns an empty array when the source program has no content in any of the three fields', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: null, benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([]);
  });

  it('preview() returns one item describing how many of the three fields have content', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: '<p>y</p>' } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 'src', label: 'Requirements, Benefits & Terms', meta: '2 field(s) with content' }]);
  });

  it('countFor() returns 1 when any field has content, 0 when the program has none or does not exist', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    expect(await copier.countFor('src')).toBe(1);
    expect(await copier.countFor('missing')).toBe(0);
  });
});
