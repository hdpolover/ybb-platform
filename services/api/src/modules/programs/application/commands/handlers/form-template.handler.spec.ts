import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CreateFormTemplateHandler,
  UpdateFormTemplateHandler,
  DeleteFormTemplateHandler,
} from './form-template.handler';
import {
  CreateFormTemplateCommand,
  UpdateFormTemplateCommand,
  DeleteFormTemplateCommand,
} from '../form-template.commands';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Helper that wires $transaction to invoke its callback with the mock itself.
function mkPrisma(
  overrides: Partial<{
    systemFieldFindUnique: unknown;
    templateCreate: unknown;
    templateUpdate: unknown;
    templateFindFirst: unknown;
    templateUpdateMany: unknown;
  }> = {},
): PrismaService {
  const base: any = {
    systemFormFieldDefinition: {
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.systemFieldFindUnique ?? null),
    },
    applicationFormTemplate: {
      create: jest.fn().mockResolvedValue(overrides.templateCreate ?? { id: 't1' }),
      update: jest.fn().mockResolvedValue(overrides.templateUpdate ?? { id: 't1' }),
      updateMany: jest
        .fn()
        .mockResolvedValue(overrides.templateUpdateMany ?? { count: 0 }),
      findFirst: jest.fn().mockResolvedValue(overrides.templateFindFirst ?? null),
    },
    applicationFormTemplateField: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  base.$transaction = jest
    .fn()
    .mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('CreateFormTemplateHandler', () => {
  it('creates a template with system fields', async () => {
    const prisma = mkPrisma({
      systemFieldFindUnique: { key: 'full_name', isActive: true, deletedAt: null },
    });
    const h = new CreateFormTemplateHandler(prisma);

    const result = await h.execute(
      new CreateFormTemplateCommand({
        name: 'My Template',
        fields: [
          {
            source: 'system',
            systemFieldKey: 'full_name',
            section: 'personal_details',
            isRequired: true,
            order: 1,
          },
        ],
      }),
    );

    expect(result).toEqual({ id: 't1' });
    expect((prisma as any).applicationFormTemplate.create).toHaveBeenCalled();
    expect(
      (prisma as any).applicationFormTemplateField.createMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            source: 'system',
            systemFieldKey: 'full_name',
          }),
        ]),
      }),
    );
  });

  it('rejects a template with unknown system field key', async () => {
    const prisma = mkPrisma({ systemFieldFindUnique: null });
    const h = new CreateFormTemplateHandler(prisma);
    await expect(
      h.execute(
        new CreateFormTemplateCommand({
          name: 'T',
          fields: [{ source: 'system', systemFieldKey: 'nonexistent' }],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a custom field with invalid key format', async () => {
    const prisma = mkPrisma();
    const h = new CreateFormTemplateHandler(prisma);
    await expect(
      h.execute(
        new CreateFormTemplateCommand({
          name: 'T',
          fields: [
            { source: 'custom', name: 'Bad Key', label: 'X', type: 'text' },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a custom field whose key is a magic key', async () => {
    const prisma = mkPrisma();
    const h = new CreateFormTemplateHandler(prisma);
    await expect(
      h.execute(
        new CreateFormTemplateCommand({
          name: 'T',
          fields: [
            { source: 'custom', name: 'category', label: 'X', type: 'text' },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate computed keys within a template', async () => {
    const prisma = mkPrisma({
      systemFieldFindUnique: { key: 'email', isActive: true, deletedAt: null },
    });
    const h = new CreateFormTemplateHandler(prisma);
    await expect(
      h.execute(
        new CreateFormTemplateCommand({
          name: 'T',
          fields: [
            { source: 'system', systemFieldKey: 'email' },
            { source: 'system', systemFieldKey: 'email' },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('clears isDefault on other templates in the same category when isDefault=true', async () => {
    const prisma = mkPrisma({
      systemFieldFindUnique: { key: 'full_name', isActive: true, deletedAt: null },
    });
    const h = new CreateFormTemplateHandler(prisma);
    await h.execute(
      new CreateFormTemplateCommand({
        name: 'T',
        category: 'standard',
        isDefault: true,
        fields: [{ source: 'system', systemFieldKey: 'full_name' }],
      }),
    );
    expect(
      (prisma as any).applicationFormTemplate.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: 'standard',
          isDefault: true,
        }),
        data: { isDefault: false },
      }),
    );
  });
});

describe('UpdateFormTemplateHandler', () => {
  it('throws NotFound when template does not exist', async () => {
    const prisma = mkPrisma({ templateFindFirst: null });
    const h = new UpdateFormTemplateHandler(prisma);
    await expect(
      h.execute(new UpdateFormTemplateCommand('missing', { name: 'Y' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates scalar fields without touching fields array', async () => {
    const prisma = mkPrisma({ templateFindFirst: { id: 't1' } });
    const h = new UpdateFormTemplateHandler(prisma);
    await h.execute(new UpdateFormTemplateCommand('t1', { name: 'New Name' }));
    expect((prisma as any).applicationFormTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ name: 'New Name' }),
      }),
    );
    expect(
      (prisma as any).applicationFormTemplateField.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('replaces fields atomically when fields array is provided', async () => {
    const prisma = mkPrisma({
      templateFindFirst: { id: 't1' },
      systemFieldFindUnique: { key: 'email', isActive: true, deletedAt: null },
    });
    const h = new UpdateFormTemplateHandler(prisma);
    await h.execute(
      new UpdateFormTemplateCommand('t1', {
        fields: [{ source: 'system', systemFieldKey: 'email' }],
      }),
    );
    expect(
      (prisma as any).applicationFormTemplateField.deleteMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ where: { templateId: 't1' } }),
    );
    expect(
      (prisma as any).applicationFormTemplateField.createMany,
    ).toHaveBeenCalled();
  });
});

describe('DeleteFormTemplateHandler', () => {
  it('throws NotFound when template does not exist', async () => {
    const prisma = mkPrisma({ templateFindFirst: null });
    const h = new DeleteFormTemplateHandler(prisma);
    await expect(
      h.execute(new DeleteFormTemplateCommand('missing')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes an existing template', async () => {
    const prisma = mkPrisma({ templateFindFirst: { id: 't1' } });
    const h = new DeleteFormTemplateHandler(prisma);
    await h.execute(new DeleteFormTemplateCommand('t1'));
    expect((prisma as any).applicationFormTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });
});
