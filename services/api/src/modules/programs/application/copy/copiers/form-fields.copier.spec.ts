import { FormFieldsCopier } from './form-fields.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type SourceField = {
  id: string;
  name: string;
  label: string;
  type: string;
  section: string;
  isRequired: boolean;
  order: number;
  placeholder: string | null;
  helpText: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  helpAssets: unknown;
  options: unknown;
  validationRules: unknown;
  source: 'system' | 'custom';
  systemFieldKey: string | null;
};

function srcField(over: Partial<SourceField>): SourceField {
  return {
    id: over.id ?? 'f1',
    name: over.name ?? 'field_one',
    label: over.label ?? 'Field One',
    type: over.type ?? 'text',
    section: over.section ?? 'personal_details',
    isRequired: over.isRequired ?? true,
    order: over.order ?? 0,
    placeholder: over.placeholder ?? null,
    helpText: over.helpText ?? null,
    mediaUrl: over.mediaUrl ?? null,
    mediaAlt: over.mediaAlt ?? null,
    helpAssets: over.helpAssets ?? [],
    options: over.options ?? [],
    validationRules: over.validationRules ?? {},
    source: over.source ?? 'custom',
    systemFieldKey: over.systemFieldKey ?? null,
  };
}

// Mocks Prisma: applicationFormField.findMany branches on where.programId
// ('src' => source fields, 'tgt' => existing target fields).
function mkPrisma(opts: { sourceFields?: SourceField[]; existingFields?: SourceField[] } = {}): PrismaService {
  const base: any = {
    applicationFormField: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          (where.programId === 'src' ? opts.sourceFields : opts.existingFields) ?? [],
        ),
      ),
      // Mirrors real Prisma updateMany: count reflects the rows actually
      // matched by the where clause (the target's existing rows here), not
      // a fixed stub — otherwise the replace-mode `replaced` assertion below
      // could never be satisfied by any implementation.
      updateMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          count: (where.programId === 'src' ? opts.sourceFields : opts.existingFields)?.length ?? 0,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceFields ?? []).length),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('FormFieldsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new FormFieldsCopier(mkPrisma());
    expect(copier.key).toBe('form-fields');
    expect(copier.label).toBe('Application Form Fields');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append adds new fields and skips exact-name collisions, case-sensitively', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'Email', order: 0 }), srcField({ id: 'f2', name: 'phone', order: 1 })],
      existingFields: [srcField({ id: 't1', name: 'email', order: 5 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // 'Email' does not collide with existing 'email' — exact match only.
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 0 });
  });

  it('replace soft-deletes existing fields then inserts all source fields from order 0', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 3 }), srcField({ id: 'f2', name: 'b', order: 9 })],
      existingFields: [srcField({ id: 't1', name: 'old', order: 0 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).applicationFormField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(create.mock.calls[1][0].data.order).toBe(1);
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 1 });
  });

  it('copies media and helpAssets verbatim', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({
          id: 'f1',
          name: 'tshirt_size',
          mediaUrl: 'https://cdn/x.png',
          mediaAlt: 'Size guide',
          helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h' }],
        }),
      ],
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        mediaUrl: 'https://cdn/x.png',
        mediaAlt: 'Size guide',
        helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h' }],
      }),
    );
  });

  it('copies only the selected itemIds, preserving source order', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 0 }), srcField({ id: 'f2', name: 'b', order: 1 }), srcField({ id: 'f3', name: 'c', order: 2 })],
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: ['f1', 'f3'], mode: 'append' });
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls.map((c: any) => c[0].data.name)).toEqual(['a', 'c']);
  });

  it('preview() maps rows to CopyPreviewItem with hasExternalMedia set from mediaUrl/helpAssets', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'plain', label: 'Plain Field' }),
        srcField({ id: 'f2', name: 'tshirt_size', label: 'T-Shirt Size', mediaUrl: 'https://cdn/x.png' }),
      ],
    });
    const copier = new FormFieldsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 'f1', label: 'Plain Field', meta: 'plain · text · personal_details', hasExternalMedia: false },
      { id: 'f2', label: 'T-Shirt Size', meta: 'tshirt_size · text · personal_details', hasExternalMedia: true },
    ]);
  });

  it('countFor() counts active (non-deleted) fields for the program', async () => {
    const prisma = mkPrisma({ sourceFields: [srcField({}), srcField({ id: 'f2', name: 'b' })] });
    const copier = new FormFieldsCopier(prisma);
    const count = await copier.countFor('src');
    expect(count).toBe(2);
    expect((prisma as any).applicationFormField.count).toHaveBeenCalledWith({ where: { programId: 'src', deletedAt: null } });
  });
});
