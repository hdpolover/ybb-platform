import { BadRequestException } from '@nestjs/common';
import { CopyFieldsFromProgramHandler } from './copy-fields-from-program.handler';
import { CopyFieldsFromProgramCommand } from '../copy-fields-from-program.command';
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
function mkPrisma(opts: {
  sourceFields?: SourceField[];
  existingFields?: { name: string; order: number }[];
} = {}): PrismaService {
  const base: any = {
    applicationFormField: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        where.programId === 'src'
          ? Promise.resolve(opts.sourceFields ?? [])
          : Promise.resolve(opts.existingFields ?? []),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: any }) =>
          Promise.resolve({ id: `new-${data.name}`, ...data }),
        ),
    },
  };
  base.$transaction = jest
    .fn()
    .mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('CopyFieldsFromProgramHandler', () => {
  it('rejects copying a program into itself', async () => {
    const prisma = mkPrisma({ sourceFields: [srcField({})] });
    const h = new CopyFieldsFromProgramHandler(prisma);
    await expect(
      h.execute(new CopyFieldsFromProgramCommand('tgt', 'tgt', undefined, 'append')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when there are no source fields to copy', async () => {
    const prisma = mkPrisma({ sourceFields: [] });
    const h = new CopyFieldsFromProgramHandler(prisma);
    await expect(
      h.execute(new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('append adds new fields and skips colliding keys', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'email', order: 0 }),
        srcField({ id: 'f2', name: 'phone', order: 1 }),
      ],
      existingFields: [{ name: 'email', order: 5 }],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    const result = await h.execute(
      new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append'),
    );
    expect(result.added).toEqual(['phone']);
    expect(result.skipped).toEqual(['email']);
    expect((prisma as any).applicationFormField.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).applicationFormField.create).toHaveBeenCalledTimes(1);
  });

  it('append renumbers copied fields after the max existing order', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'a', order: 0 }),
        srcField({ id: 'f2', name: 'b', order: 1 }),
      ],
      existingFields: [{ name: 'x', order: 5 }],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    await h.execute(new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append'));
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(6);
    expect(create.mock.calls[1][0].data.order).toBe(7);
  });

  it('replace soft-deletes existing fields then inserts all source fields from order 0', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'a', order: 3 }),
        srcField({ id: 'f2', name: 'b', order: 9 }),
      ],
      existingFields: [{ name: 'old', order: 0 }],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    const result = await h.execute(
      new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'replace'),
    );
    expect((prisma as any).applicationFormField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(create.mock.calls[1][0].data.order).toBe(1);
    expect(result.added).toEqual(['a', 'b']);
  });

  it('copies only the selected fieldIds, preserving source order', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'a', order: 0 }),
        srcField({ id: 'f2', name: 'b', order: 1 }),
        srcField({ id: 'f3', name: 'c', order: 2 }),
      ],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    const result = await h.execute(
      new CopyFieldsFromProgramCommand('tgt', 'src', ['f1', 'f3'], 'append'),
    );
    expect(result.added).toEqual(['a', 'c']);
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
    const h = new CopyFieldsFromProgramHandler(prisma);
    await h.execute(new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append'));
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        mediaUrl: 'https://cdn/x.png',
        mediaAlt: 'Size guide',
        helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h' }],
      }),
    );
  });
});
