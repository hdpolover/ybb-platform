import { NotFoundException } from '@nestjs/common';
import { ApplyFormTemplateHandler } from './apply-form-template.handler';
import { ApplyFormTemplateCommand } from '../apply-form-template.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(opts: Partial<{
  templateFindFirst: unknown;
  existingFields: unknown[];
  systemFieldByKey: Record<string, unknown>;
}> = {}): PrismaService {
  const base: any = {
    applicationFormTemplate: {
      findFirst: jest.fn().mockResolvedValue(opts.templateFindFirst ?? null),
    },
    applicationFormField: {
      findMany: jest.fn().mockResolvedValue(opts.existingFields ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
    },
    systemFormFieldDefinition: {
      findUnique: jest.fn().mockImplementation(({ where: { key } }: any) =>
        Promise.resolve(opts.systemFieldByKey?.[key] ?? null),
      ),
    },
  };
  base.$transaction = jest
    .fn()
    .mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('ApplyFormTemplateHandler', () => {
  it('throws NotFound for an unknown template', async () => {
    const prisma = mkPrisma({ templateFindFirst: null });
    const h = new ApplyFormTemplateHandler(prisma);
    await expect(
      h.execute(new ApplyFormTemplateCommand('p1', 'missing', 'append')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('append mode adds new fields and skips colliding keys', async () => {
    const prisma = mkPrisma({
      templateFindFirst: {
        id: 't1',
        fields: [
          { source: 'system', systemFieldKey: 'email', section: 'personal_details', isRequired: true, order: 1,
            labelOverride: null, helpTextOverride: null, label: null, type: null, name: null,
            placeholder: null, helpText: null, options: [], validationRules: {} },
          { source: 'system', systemFieldKey: 'phone', section: 'personal_details', isRequired: true, order: 2,
            labelOverride: null, helpTextOverride: null, label: null, type: null, name: null,
            placeholder: null, helpText: null, options: [], validationRules: {} },
        ],
      },
      existingFields: [{ name: 'email' }],
      systemFieldByKey: {
        email: { key: 'email', label: 'Email', type: 'email', defaultOptions: [], helpText: null, isActive: true, deletedAt: null },
        phone: { key: 'phone', label: 'Phone', type: 'phone', defaultOptions: [], helpText: null, isActive: true, deletedAt: null },
      },
    });
    const h = new ApplyFormTemplateHandler(prisma);
    const result = await h.execute(new ApplyFormTemplateCommand('p1', 't1', 'append'));

    expect(result.mode).toBe('append');
    expect(result.added).toEqual(['phone']);
    expect(result.skipped).toEqual(['email']);
    expect((prisma as any).applicationFormField.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).applicationFormField.create).toHaveBeenCalledTimes(1);
  });

  it('replace mode soft-deletes existing fields and inserts all template fields', async () => {
    const prisma = mkPrisma({
      templateFindFirst: {
        id: 't1',
        fields: [
          { source: 'system', systemFieldKey: 'email', section: 'personal_details', isRequired: true, order: 1,
            labelOverride: null, helpTextOverride: null, label: null, type: null, name: null,
            placeholder: null, helpText: null, options: [], validationRules: {} },
        ],
      },
      existingFields: [{ name: 'old_field' }],
      systemFieldByKey: {
        email: { key: 'email', label: 'Email', type: 'email', defaultOptions: [], helpText: null, isActive: true, deletedAt: null },
      },
    });
    const h = new ApplyFormTemplateHandler(prisma);
    const result = await h.execute(new ApplyFormTemplateCommand('p1', 't1', 'replace'));

    expect((prisma as any).applicationFormField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'p1', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    expect(result.added).toEqual(['email']);
    expect(result.skipped).toEqual([]);
  });

  it('skips system fields whose catalog entry is inactive or missing', async () => {
    const prisma = mkPrisma({
      templateFindFirst: {
        id: 't1',
        fields: [
          { source: 'system', systemFieldKey: 'legacy', section: 'misc', isRequired: false, order: 1,
            labelOverride: null, helpTextOverride: null, label: null, type: null, name: null,
            placeholder: null, helpText: null, options: [], validationRules: {} },
          { source: 'system', systemFieldKey: 'gone', section: 'misc', isRequired: false, order: 2,
            labelOverride: null, helpTextOverride: null, label: null, type: null, name: null,
            placeholder: null, helpText: null, options: [], validationRules: {} },
        ],
      },
      systemFieldByKey: {
        legacy: { key: 'legacy', label: 'Legacy', type: 'text', defaultOptions: [], helpText: null, isActive: false, deletedAt: null },
        // 'gone' returns null from findUnique
      },
    });
    const h = new ApplyFormTemplateHandler(prisma);
    const result = await h.execute(new ApplyFormTemplateCommand('p1', 't1', 'append'));

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(['legacy', 'gone']);
  });

  it('inserts custom template fields directly without catalog lookup', async () => {
    const prisma = mkPrisma({
      templateFindFirst: {
        id: 't1',
        fields: [
          { source: 'custom', systemFieldKey: null, name: 'volunteer_experience',
            label: 'Volunteer Experience', type: 'textarea', section: 'miscellaneous',
            isRequired: false, order: 1, labelOverride: null, helpTextOverride: null,
            placeholder: null, helpText: null, options: [], validationRules: {} },
        ],
      },
    });
    const h = new ApplyFormTemplateHandler(prisma);
    const result = await h.execute(new ApplyFormTemplateCommand('p1', 't1', 'append'));

    expect(result.added).toEqual(['volunteer_experience']);
    expect((prisma as any).applicationFormField.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'volunteer_experience',
          source: 'custom',
          type: 'textarea',
          label: 'Volunteer Experience',
        }),
      }),
    );
  });
});
