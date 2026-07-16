import { NotFoundException } from '@nestjs/common';
import {
  GetFormTemplatesHandler,
  GetFormTemplateByIdHandler,
} from './get-form-templates.handler';
import {
  GetFormTemplatesQuery,
  GetFormTemplateByIdQuery,
} from '../get-form-templates.query';

describe('GetFormTemplatesHandler', () => {
  it('returns summaries with fieldCount derived from _count', async () => {
    const prisma = {
      applicationFormTemplate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            name: 'A',
            description: null,
            category: null,
            isDefault: false,
            updatedAt: new Date('2026-01-01T00:00:00Z'),
            _count: { fields: 3 },
          },
        ]),
      },
    };
    const handler = new GetFormTemplatesHandler(prisma as never);
    const result = await handler.execute(new GetFormTemplatesQuery());
    expect(result).toHaveLength(1);
    expect(result[0].fieldCount).toBe(3);
    expect(prisma.applicationFormTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        include: { _count: { select: { fields: true } } },
      }),
    );
  });
});

describe('GetFormTemplateByIdHandler', () => {
  it('returns the template with its fields', async () => {
    const template = {
      id: 't1',
      name: 'A',
      description: null,
      category: null,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      fields: [
        {
          id: 'f1',
          source: 'system',
          systemFieldKey: 'email',
          name: null,
          label: null,
          type: null,
          section: 'personal_details',
          isRequired: true,
          order: 1,
          labelOverride: null,
          helpTextOverride: null,
        },
      ],
    };
    const prisma = {
      applicationFormTemplate: {
        findFirst: jest.fn().mockResolvedValue(template),
      },
    };
    const handler = new GetFormTemplateByIdHandler(prisma as never);
    const result = await handler.execute(new GetFormTemplateByIdQuery('t1'));
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].systemFieldKey).toBe('email');
  });

  it('throws NotFound when template does not exist', async () => {
    const prisma = {
      applicationFormTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const handler = new GetFormTemplateByIdHandler(prisma as never);
    await expect(
      handler.execute(new GetFormTemplateByIdQuery('nope')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
