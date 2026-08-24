import { BadRequestException } from '@nestjs/common';
import { FormFieldsCopier } from './form-fields.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Mirrors program-details.copier.spec.ts's helper: BadRequestException here
// carries a structured { code, message } response body (from copy-scoped-
// rows.ts's guard and template-payload.schemas.ts's parseTemplateItems), and
// Nest's HttpException surfaces that body's own `message` string as the
// thrown error's `.message` — not the `code` — so `.rejects.toThrow(/code/)`
// can never match. Asserting on `.getResponse().code` is this codebase's
// established way to check a structured exception's code.
async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

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

describe('FormFieldsCopier.exportTemplate', () => {
  it('exports custom-sourced fields with their full resolved shape', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'tshirt_size', source: 'custom', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'form-fields',
      payloadVersion: 1,
      items: [
        expect.objectContaining({ source: 'custom', name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] }),
      ],
    });
  });

  it('exports system-sourced fields WITHOUT label/type/helpText/options — only systemFieldKey/section/isRequired/order', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'full_name', source: 'system', systemFieldKey: 'full_name', label: 'Full Legal Name (customized on this program)', type: 'text' })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([
      { source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0 },
    ]);
    // Explicitly not present — a system field's label is never frozen at export time.
    expect(payload.items[0]).not.toHaveProperty('label');
    expect(payload.items[0]).not.toHaveProperty('type');
  });

  it('honors itemIds', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 0 }), srcField({ id: 'f2', name: 'b', order: 1 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src', ['f2']);
    expect(payload.items).toHaveLength(1);
  });
});

describe('FormFieldsCopier.applyTemplate', () => {
  function mkPrismaWithCatalog(opts: { existingFields?: SourceField[]; catalog?: Record<string, { type: string; label: string; defaultOptions: unknown; helpText: string | null; isActive: boolean; deletedAt: Date | null }> } = {}): PrismaService {
    const base: any = {
      applicationFormField: {
        findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.programId === 'tgt' ? (opts.existingFields ?? []) : [])),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      },
      systemFormFieldDefinition: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(opts.catalog?.[where.key] ? { key: where.key, ...opts.catalog[where.key] } : null)),
      },
    };
    base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
    return base as PrismaService;
  }

  it('re-resolves a thin system-sourced item against the live catalog (type, label, helpText, options all come from the catalog)', async () => {
    const prisma = mkPrismaWithCatalog({
      catalog: { full_name: { type: 'text', label: 'Full Name (catalog, current)', defaultOptions: [], helpText: 'Catalog help', isActive: true, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'form-fields', payloadVersion: 1, items: [{ source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0 }] },
      'tgt',
      'append',
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'full_name', label: 'Full Name (catalog, current)', type: 'text', helpText: 'Catalog help' }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('a set labelOverride wins over the catalog label; an unset one always follows the catalog', async () => {
    const prisma = mkPrismaWithCatalog({
      catalog: { full_name: { type: 'text', label: 'Catalog Label', defaultOptions: [], helpText: null, isActive: true, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      prisma,
      {
        entityType: 'form-fields',
        payloadVersion: 1,
        items: [
          { source: 'system', systemFieldKey: 'full_name', name: null, label: null, type: null, placeholder: null, helpText: null, options: [], validationRules: {}, section: 'personal_details', isRequired: true, order: 0, labelOverride: 'Frozen Legal Name', helpTextOverride: null },
        ],
      },
      'tgt',
      'append',
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.label).toBe('Frozen Legal Name');
  });

  it('skips (does not create) a system-sourced item whose catalog entry is inactive or deleted', async () => {
    const prisma = mkPrismaWithCatalog({
      catalog: { retired_field: { type: 'text', label: 'x', defaultOptions: [], helpText: null, isActive: false, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'form-fields', payloadVersion: 1, items: [{ source: 'system', systemFieldKey: 'retired_field', section: 'personal_details', isRequired: true, order: 0 }] },
      'tgt',
      'append',
    );
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
  });

  it('applies a custom-sourced item verbatim, no catalog lookup', async () => {
    const prisma = mkPrismaWithCatalog();
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      prisma,
      {
        entityType: 'form-fields',
        payloadVersion: 1,
        items: [{ source: 'custom', name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', placeholder: null, helpText: null, options: [{ label: 'M', value: 'm' }], validationRules: {}, section: 'miscellaneous', isRequired: false, order: 0 }],
      },
      'tgt',
      'append',
    );
    expect((prisma as any).systemFormFieldDefinition.findUnique).not.toHaveBeenCalled();
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.label).toBe('T-Shirt Size');
  });

  it('replace with an empty template payload throws BadRequestException before any mutation', async () => {
    const prisma = mkPrismaWithCatalog({ existingFields: [srcField({ id: 't1', name: 'old' })] });
    const copier = new FormFieldsCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(prisma, { entityType: 'form-fields', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((prisma as any).applicationFormField.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload (missing source) via parseTemplateItems before touching the database', async () => {
    const prisma = mkPrismaWithCatalog();
    const copier = new FormFieldsCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(prisma, { entityType: 'form-fields', payloadVersion: 1, items: [{ section: 'personal_details' }] as any }, 'tgt', 'append'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('invalid_template_payload');
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
  });
});

describe('FormFieldsCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces a custom-sourced field on the target program', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'tshirt_size', source: 'custom', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(prisma, payload, 'tgt', 'append');
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
