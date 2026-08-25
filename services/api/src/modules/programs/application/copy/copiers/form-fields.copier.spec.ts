import { BadRequestException } from '@nestjs/common';
import { FormFieldsCopier } from './form-fields.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

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

// Builds a disjoint `{ prisma, tx }` pair (see prisma-tx-mock.ts): `prisma`
// is what the copier reads through outside a transaction (countFor,
// preview, exportTemplate); `tx` is what copy()/applyTemplate() read and
// write through — applicationFormField.findMany branches on where.programId
// ('src' => source fields, 'tgt' => existing target fields), identically on
// both mocks, but as independently-tracked jest.fn() sets.
function mkPrisma(opts: { sourceFields?: SourceField[]; existingFields?: SourceField[] } = {}) {
  const buildModels = () => ({
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
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
}

describe('FormFieldsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new FormFieldsCopier(mkPrisma().prisma);
    expect(copier.key).toBe('form-fields');
    expect(copier.label).toBe('Application Form Fields');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append adds new fields and skips exact-name collisions, case-sensitively', async () => {
    const { prisma, tx } = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'Email', order: 0 }), srcField({ id: 'f2', name: 'phone', order: 1 })],
      existingFields: [srcField({ id: 't1', name: 'email', order: 5 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // 'Email' does not collide with existing 'email' — exact match only.
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 0 });
  });

  it('replace soft-deletes existing fields then inserts all source fields from order 0', async () => {
    const { prisma, tx } = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 3 }), srcField({ id: 'f2', name: 'b', order: 9 })],
      existingFields: [srcField({ id: 't1', name: 'old', order: 0 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((tx as any).applicationFormField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(create.mock.calls[1][0].data.order).toBe(1);
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 1 });
    // The whole point of the disjoint prisma/tx mock: prove the writes went
    // through the transactional client, not around it via the ambient
    // this.prisma the copier also holds for reads.
    expect((prisma as any).applicationFormField.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
  });

  it('copies media and helpAssets verbatim', async () => {
    const { prisma, tx } = mkPrisma({
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
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        mediaUrl: 'https://cdn/x.png',
        mediaAlt: 'Size guide',
        helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h' }],
      }),
    );
  });

  it('copies only the selected itemIds, preserving source order', async () => {
    const { prisma, tx } = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 0 }), srcField({ id: 'f2', name: 'b', order: 1 }), srcField({ id: 'f3', name: 'c', order: 2 })],
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: ['f1', 'f3'], mode: 'append' });
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls.map((c: any) => c[0].data.name)).toEqual(['a', 'c']);
  });

  it('preview() maps rows to CopyPreviewItem with hasExternalMedia set from mediaUrl/helpAssets', async () => {
    const { prisma } = mkPrisma({
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
    const { prisma } = mkPrisma({ sourceFields: [srcField({}), srcField({ id: 'f2', name: 'b' })] });
    const copier = new FormFieldsCopier(prisma);
    const count = await copier.countFor('src');
    expect(count).toBe(2);
    expect((prisma as any).applicationFormField.count).toHaveBeenCalledWith({ where: { programId: 'src', deletedAt: null } });
  });
});

describe('FormFieldsCopier.exportTemplate', () => {
  it('exports custom-sourced fields with their full resolved shape', async () => {
    const { prisma } = mkPrisma({
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

  it('exports system-sourced fields WITHOUT label/type/helpText/options — only systemFieldKey/section/isRequired/order/media', async () => {
    const { prisma } = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'full_name', source: 'system', systemFieldKey: 'full_name', label: 'Full Legal Name (customized on this program)', type: 'text' })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    // mediaUrl/mediaAlt/helpAssets ARE present (null/null/[] here, from
    // srcField's defaults) — they're per-instance data, not catalog data, so
    // unlike label/type/helpText/options they're never re-resolved and must
    // round-trip through the thin shape too.
    expect(payload.items).toEqual([
      { source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0, mediaUrl: null, mediaAlt: null, helpAssets: [] },
    ]);
    // Explicitly not present — a system field's label is never frozen at export time.
    expect(payload.items[0]).not.toHaveProperty('label');
    expect(payload.items[0]).not.toHaveProperty('type');
  });

  it('honors itemIds', async () => {
    const { prisma } = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 0 }), srcField({ id: 'f2', name: 'b', order: 1 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src', ['f2']);
    expect(payload.items).toHaveLength(1);
  });

  it('captures mediaUrl/mediaAlt/helpAssets verbatim for both custom- and system-sourced fields', async () => {
    const { prisma } = mkPrisma({
      sourceFields: [
        srcField({
          id: 'f1',
          name: 'tshirt_size',
          source: 'custom',
          mediaUrl: 'https://cdn/custom.png',
          mediaAlt: 'Size guide',
          helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h/custom' }],
        }),
        srcField({
          id: 'f2',
          name: 'full_name',
          source: 'system',
          systemFieldKey: 'full_name',
          mediaUrl: 'https://cdn/system.png',
          mediaAlt: 'ID guide',
          helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h/system' }],
        }),
      ],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items[0]).toEqual(
      expect.objectContaining({ mediaUrl: 'https://cdn/custom.png', mediaAlt: 'Size guide', helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h/custom' }] }),
    );
    expect(payload.items[1]).toEqual(
      expect.objectContaining({ mediaUrl: 'https://cdn/system.png', mediaAlt: 'ID guide', helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h/system' }] }),
    );
  });
});

describe('FormFieldsCopier.applyTemplate', () => {
  // Same disjoint-mock shape as mkPrisma above, plus systemFormFieldDefinition
  // for the catalog lookups applyTemplate() makes through `tx`.
  function mkPrismaWithCatalog(opts: { existingFields?: SourceField[]; catalog?: Record<string, { type: string; label: string; defaultOptions: unknown; helpText: string | null; isActive: boolean; deletedAt: Date | null }> } = {}) {
    const buildModels = () => ({
      applicationFormField: {
        findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.programId === 'tgt' ? (opts.existingFields ?? []) : [])),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      },
      systemFormFieldDefinition: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(opts.catalog?.[where.key] ? { key: where.key, ...opts.catalog[where.key] } : null)),
      },
    });
    const { prisma, tx } = createPrismaTxMock(buildModels);
    return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService };
  }

  it('re-resolves a thin system-sourced item against the live catalog (type, label, helpText, options all come from the catalog)', async () => {
    const { prisma, tx } = mkPrismaWithCatalog({
      // catalog type is deliberately 'select', not 'text' — the thin item
      // carries no `type` at all, so a buggy `item.type ?? 'text'` fallback
      // would coincidentally match a 'text' catalog type and this assertion
      // would pass for the wrong reason.
      catalog: { full_name: { type: 'select', label: 'Full Name (catalog, current)', defaultOptions: [], helpText: 'Catalog help', isActive: true, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      { entityType: 'form-fields', payloadVersion: 1, items: [{ source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0 }] },
      'tgt',
      'append',
    );
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'full_name', label: 'Full Name (catalog, current)', type: 'select', helpText: 'Catalog help' }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
    // Same disjoint-mock guard as copy(): applyTemplate() must read/write
    // exclusively through tx, never around it via this.prisma.
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
    expect((prisma as any).systemFormFieldDefinition.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to the catalog defaultOptions when the item carries no options of its own', async () => {
    const { prisma, tx } = mkPrismaWithCatalog({
      catalog: {
        favorite_color: {
          type: 'select',
          label: 'Favorite Color',
          defaultOptions: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }],
          helpText: null,
          isActive: true,
          deletedAt: null,
        },
      },
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      tx,
      { entityType: 'form-fields', payloadVersion: 1, items: [{ source: 'system', systemFieldKey: 'favorite_color', section: 'personal_details', isRequired: true, order: 0 }] },
      'tgt',
      'append',
    );
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.options).toEqual([{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }]);
  });

  it('a set labelOverride wins over the catalog label; an unset one always follows the catalog', async () => {
    const { prisma, tx } = mkPrismaWithCatalog({
      catalog: { full_name: { type: 'text', label: 'Catalog Label', defaultOptions: [], helpText: null, isActive: true, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      tx,
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
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.label).toBe('Frozen Legal Name');
  });

  it('skips (does not create) a system-sourced item whose catalog entry is inactive or deleted', async () => {
    const { prisma, tx } = mkPrismaWithCatalog({
      catalog: { retired_field: { type: 'text', label: 'x', defaultOptions: [], helpText: null, isActive: false, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.applyTemplate(
      tx,
      { entityType: 'form-fields', payloadVersion: 1, items: [{ source: 'system', systemFieldKey: 'retired_field', section: 'personal_details', isRequired: true, order: 0 }] },
      'tgt',
      'append',
    );
    expect((tx as any).applicationFormField.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
  });

  it('applies a custom-sourced item verbatim, no catalog lookup', async () => {
    const { prisma, tx } = mkPrismaWithCatalog();
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      tx,
      {
        entityType: 'form-fields',
        payloadVersion: 1,
        items: [{ source: 'custom', name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', placeholder: null, helpText: null, options: [{ label: 'M', value: 'm' }], validationRules: {}, section: 'miscellaneous', isRequired: false, order: 0 }],
      },
      'tgt',
      'append',
    );
    expect((tx as any).systemFormFieldDefinition.findUnique).not.toHaveBeenCalled();
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.label).toBe('T-Shirt Size');
  });

  it('a set labelOverride/helpTextOverride wins over a custom-sourced item\'s own label/helpText (the legacy migration shape is not gated by source)', async () => {
    const { prisma, tx } = mkPrismaWithCatalog();
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      tx,
      {
        entityType: 'form-fields',
        payloadVersion: 1,
        items: [
          {
            source: 'custom',
            name: 'tshirt_size',
            label: 'T-Shirt Size',
            type: 'select',
            placeholder: null,
            helpText: 'Original help',
            options: [{ label: 'M', value: 'm' }],
            validationRules: {},
            section: 'miscellaneous',
            isRequired: false,
            order: 0,
            labelOverride: 'Frozen Custom Label',
            helpTextOverride: 'Frozen Custom Help',
          },
        ],
      },
      'tgt',
      'append',
    );
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.label).toBe('Frozen Custom Label');
    expect(create.mock.calls[0][0].data.helpText).toBe('Frozen Custom Help');
  });

  it('preserves mediaUrl/mediaAlt/helpAssets from the template item, for both system- and custom-sourced items', async () => {
    const { prisma, tx } = mkPrismaWithCatalog({
      catalog: { full_name: { type: 'text', label: 'Catalog Label', defaultOptions: [], helpText: null, isActive: true, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      tx,
      {
        entityType: 'form-fields',
        payloadVersion: 1,
        items: [
          {
            source: 'system',
            systemFieldKey: 'full_name',
            section: 'personal_details',
            isRequired: true,
            order: 0,
            mediaUrl: 'https://cdn/sys.png',
            mediaAlt: 'Sys guide',
            helpAssets: [{ kind: 'link', label: 'Sys', url: 'https://s' }],
          },
          {
            source: 'custom',
            name: 'tshirt_size',
            label: 'T-Shirt Size',
            type: 'select',
            section: 'miscellaneous',
            isRequired: false,
            order: 1,
            mediaUrl: 'https://cdn/custom.png',
            mediaAlt: 'Custom guide',
            helpAssets: [{ kind: 'link', label: 'Custom', url: 'https://c' }],
          },
        ],
      },
      'tgt',
      'append',
    );
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ mediaUrl: 'https://cdn/sys.png', mediaAlt: 'Sys guide', helpAssets: [{ kind: 'link', label: 'Sys', url: 'https://s' }] }),
    );
    expect(create.mock.calls[1][0].data).toEqual(
      expect.objectContaining({ mediaUrl: 'https://cdn/custom.png', mediaAlt: 'Custom guide', helpAssets: [{ kind: 'link', label: 'Custom', url: 'https://c' }] }),
    );
  });

  it('replace with an empty template payload throws BadRequestException before any mutation', async () => {
    const { prisma, tx } = mkPrismaWithCatalog({ existingFields: [srcField({ id: 't1', name: 'old' })] });
    const copier = new FormFieldsCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'form-fields', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_replace_source');
    expect((tx as any).applicationFormField.updateMany).not.toHaveBeenCalled();
    expect((tx as any).applicationFormField.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload (missing source) via parseTemplateItems before touching the database', async () => {
    const { prisma, tx } = mkPrismaWithCatalog();
    const copier = new FormFieldsCopier(prisma);
    const err = await captureError(
      copier.applyTemplate(tx, { entityType: 'form-fields', payloadVersion: 1, items: [{ section: 'personal_details' }] as any }, 'tgt', 'append'),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('invalid_template_payload');
    expect((tx as any).applicationFormField.create).not.toHaveBeenCalled();
  });
});

describe('FormFieldsCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces a custom-sourced field on the target program', async () => {
    const { prisma, tx } = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'tshirt_size', source: 'custom', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(tx, payload, 'tgt', 'append');
    const create = (tx as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
