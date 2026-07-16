import { GetSystemFormFieldsHandler } from './get-system-form-fields.handler';
import { GetSystemFormFieldsQuery } from '../get-system-form-fields.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('GetSystemFormFieldsHandler', () => {
  const mkPrisma = (rows: unknown[]) =>
    ({
      systemFormFieldDefinition: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    }) as unknown as PrismaService;

  it('returns only active definitions by default', async () => {
    const prisma = mkPrisma([
      {
        id: '1',
        key: 'full_name',
        label: 'Full Name',
        category: 'identity',
        type: 'text',
        defaultOptions: [],
        helpText: null,
        isMagic: false,
        isActive: true,
        order: 1,
      },
    ]);
    const handler = new GetSystemFormFieldsHandler(prisma);
    const result = await handler.execute(new GetSystemFormFieldsQuery());

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('full_name');
    expect((prisma.systemFormFieldDefinition.findMany as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, deletedAt: null },
      }),
    );
  });

  it('includes inactive definitions when includeInactive=true', async () => {
    const prisma = mkPrisma([
      {
        id: '1', key: 'legacy_field', label: 'Legacy', category: 'misc', type: 'text',
        defaultOptions: [], helpText: null, isMagic: false, isActive: false, order: 99,
      },
    ]);
    const handler = new GetSystemFormFieldsHandler(prisma);
    await handler.execute(new GetSystemFormFieldsQuery(true));

    expect((prisma.systemFormFieldDefinition.findMany as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
      }),
    );
  });

  it('coerces null defaultOptions to empty array', async () => {
    const prisma = mkPrisma([
      {
        id: '1', key: 'x', label: 'X', category: 'misc', type: 'text',
        defaultOptions: null, helpText: null, isMagic: false, isActive: true, order: 1,
      },
    ]);
    const handler = new GetSystemFormFieldsHandler(prisma);
    const [row] = await handler.execute(new GetSystemFormFieldsQuery());
    expect(row.defaultOptions).toEqual([]);
  });

  it('orders by category, then order, then label', async () => {
    const prisma = mkPrisma([]);
    const handler = new GetSystemFormFieldsHandler(prisma);
    await handler.execute(new GetSystemFormFieldsQuery());

    expect((prisma.systemFormFieldDefinition.findMany as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ category: 'asc' }, { order: 'asc' }, { label: 'asc' }],
      }),
    );
  });
});
