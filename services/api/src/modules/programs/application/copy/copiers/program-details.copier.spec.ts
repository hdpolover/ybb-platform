// services/api/src/modules/programs/application/copy/copiers/program-details.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ProgramDetailsCopier } from './program-details.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type ProgramFixture = {
  requirementsDescription: string | null;
  benefitsDescription: string | null;
  termsAndConditions: string | null;
};

function mkPrisma(programs: Record<string, ProgramFixture>): PrismaService {
  const base: any = {
    program: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(programs[where.id] ?? null)),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

describe('ProgramDetailsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ProgramDetailsCopier(mkPrisma({}));
    expect(copier.key).toBe('program-details');
    expect(copier.label).toBe('Participant-Facing Content');
    expect(copier.supportsAppend).toBe(false);
  });

  it('replace copies all three scalar fields onto a target with no prior content', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '<p>Bring a laptop</p>', benefitsDescription: '<p>Certificate</p>', termsAndConditions: '<p>No refunds</p>' },
      // tgt intentionally absent from the fixture map, so findUnique('tgt')
      // resolves null — the target starts with nothing to overwrite.
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
    // created: 1 — the shared copy dialog's success toast is built as
    // `Copied ${result.created} item(s).` and never reads `replaced`; this
    // section is exactly one selectable item, so a successful copy must
    // report created: 1 or the toast reads "Copied 0 item(s)." on success.
    // replaced: 0 — the target had no prior content to overwrite.
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('replace reports replaced: 1 when the target already had content that got overwritten', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '<p>New requirements</p>', benefitsDescription: null, termsAndConditions: null },
      tgt: { requirementsDescription: '<p>Old requirements</p>', benefitsDescription: '<p>Old benefits</p>', termsAndConditions: null },
    });
    const copier = new ProgramDetailsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
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
  // to prove both count as "no content".
  it('rejects replace from a source with no content in any of the three fields (null/empty string)', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: null, benefitsDescription: '', termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // The admin editor is Tiptap (rich-text-editor.tsx), which emits HTML.
  // Clearing a field in the UI saves `<p></p>`, not `''` — a raw
  // Boolean(value) check reads that as "has content" and would let a
  // visually-empty field through as real content. This test fails against
  // a naive `.filter(Boolean)` implementation (verified before finalising).
  it('rejects replace from a source whose fields contain only empty Tiptap markup (<p></p>)', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '<p></p>', benefitsDescription: '<p></p>', termsAndConditions: '<p></p>' },
    });
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // Whitespace-only content (no tags at all) must also count as blank —
  // this exercises the trim() half of the emptiness check independently of
  // the tag-stripping half. Also fails against a naive Boolean(value) check.
  it('rejects replace from a source whose fields contain only whitespace', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '   ', benefitsDescription: '\n\t', termsAndConditions: '  \n  ' },
    });
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // Fix 4: `&nbsp;`-only content (no surrounding tags) must also count as
  // blank, same as the tag-collapsed nbsp case already covered above.
  it('rejects replace from a source whose fields contain only &nbsp;', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '&nbsp;', benefitsDescription: '&nbsp;&nbsp;', termsAndConditions: null },
    });
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // Fix 4: a field whose only content is an <img> (or <hr>) strips to ''
  // under the tag-stripping check, which would wrongly judge it blank. A
  // source that is entirely an image must NOT be refused as "no content to
  // copy", and a target that is entirely an image must count as content the
  // replace overwrote (targetHadContent / `replaced`).
  it('treats an image-only field as content, not blank: proceeds and reports replaced when the target was image-only too', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '<img src="https://cdn.example/x.png">', benefitsDescription: null, termsAndConditions: null },
      tgt: { requirementsDescription: '<img src="https://cdn.example/old.png">', benefitsDescription: null, termsAndConditions: null },
    });
    const copier = new ProgramDetailsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalled();
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('treats an <hr>-only field as content, not blank, in preview()', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<hr>', benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 'src', label: 'Requirements, Benefits & Terms', meta: '1 field(s) with content', hasExternalMedia: false },
    ]);
  });

  // The error message must advise something the user can actually do.
  // supportsAppend is false and copy() rejects append mode outright, so
  // telling the user to "use append mode instead" (copied verbatim from
  // copy-scoped-rows.ts) would be impossible advice.
  it('empty-source error message does not suggest the unsupported append mode', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: null, benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const err = await captureError(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    const response = err.getResponse() as { code: string; message: string };
    expect(response.code).toBe('empty_replace_source');
    expect(response.message).not.toMatch(/append/i);
  });

  // Partial content is not the destructive all-empty case: a source with
  // even one populated field is a legitimate replace, including blanking
  // out the other two on the target (ordinary replace semantics, not data
  // loss).
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
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('preview() returns an empty array when the source program has no content in any of the three fields', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: null, benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([]);
  });

  it('preview() treats empty Tiptap markup as no content, same as copy()', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p></p>', benefitsDescription: '<p>  </p>', termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([]);
  });

  it('preview() returns one item describing how many of the three fields have content', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: '<p>y</p>' } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 'src', label: 'Requirements, Benefits & Terms', meta: '2 field(s) with content', hasExternalMedia: false },
    ]);
  });

  // Fix 1: program-details is edited with Tiptap, which can embed
  // `<img src="...">` pointing at the source brand's storage. preview()
  // must flag this so the shared dialog's cross-brand warning (which reads
  // hasExternalMedia exclusively) actually fires for this surface.
  it('preview() sets hasExternalMedia: true when any of the three fields embeds an <img>', async () => {
    const prisma = mkPrisma({
      src: {
        requirementsDescription: '<p>Bring a laptop</p>',
        benefitsDescription: '<p><img src="https://other-brand.example/x.png"></p>',
        termsAndConditions: null,
      },
    });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items[0].hasExternalMedia).toBe(true);
  });

  it('preview() sets hasExternalMedia: false when no field embeds img/iframe/video', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '<p>Plain text, no media</p>', benefitsDescription: null, termsAndConditions: null },
    });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items[0].hasExternalMedia).toBe(false);
  });

  it('countFor() returns 1 when any field has content, 0 when the program has none or does not exist', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    expect(await copier.countFor('src')).toBe(1);
    expect(await copier.countFor('missing')).toBe(0);
  });
});
