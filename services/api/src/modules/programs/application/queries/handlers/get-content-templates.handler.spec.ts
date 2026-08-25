// services/api/src/modules/programs/application/queries/handlers/get-content-templates.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { GetContentTemplatesHandler, GetContentTemplateByIdHandler } from './get-content-templates.handler';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../get-content-templates.query';

function row(over: Partial<{ id: string; entityType: string; payload: unknown; deletedAt: Date | null }> = {}) {
  return {
    id: over.id ?? 't1',
    name: 'Standard FAQs',
    description: null,
    entityType: over.entityType ?? 'faqs',
    payload: over.payload ?? { entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?' }, { question: 'Q2?' }] },
    payloadVersion: 1,
    isDefault: false,
    createdAt: new Date('2026-08-24'),
    updatedAt: new Date('2026-08-24'),
  };
}

describe('GetContentTemplatesHandler', () => {
  it('lists templates, deriving itemCount from payload.items.length', async () => {
    const prisma: any = { contentTemplate: { findMany: jest.fn().mockResolvedValue([row()]) } };
    const handler = new GetContentTemplatesHandler(prisma);
    const result = await handler.execute(new GetContentTemplatesQuery());
    expect(result).toEqual([expect.objectContaining({ id: 't1', itemCount: 2 })]);
  });

  it('filters by entityType when provided', async () => {
    const prisma: any = { contentTemplate: { findMany: jest.fn().mockResolvedValue([]) } };
    const handler = new GetContentTemplatesHandler(prisma);
    await handler.execute(new GetContentTemplatesQuery('faqs'));
    expect(prisma.contentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, entityType: 'faqs' } }),
    );
  });

  it('omits the entityType filter when not provided', async () => {
    const prisma: any = { contentTemplate: { findMany: jest.fn().mockResolvedValue([]) } };
    const handler = new GetContentTemplatesHandler(prisma);
    await handler.execute(new GetContentTemplatesQuery());
    expect(prisma.contentTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });
});

describe('GetContentTemplateByIdHandler', () => {
  it('returns the detail DTO including the full payload', async () => {
    const prisma: any = { contentTemplate: { findFirst: jest.fn().mockResolvedValue(row()) } };
    const handler = new GetContentTemplateByIdHandler(prisma);
    const result = await handler.execute(new GetContentTemplateByIdQuery('t1'));
    expect(result.payload).toEqual({ entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?' }, { question: 'Q2?' }] });
    expect(result.itemCount).toBe(2);
  });

  it('throws NotFoundException when missing or soft-deleted', async () => {
    const prisma: any = { contentTemplate: { findFirst: jest.fn().mockResolvedValue(null) } };
    const handler = new GetContentTemplateByIdHandler(prisma);
    await expect(handler.execute(new GetContentTemplateByIdQuery('missing'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('excludes soft-deleted rows from findFirst\'s where clause', async () => {
    const prisma: any = { contentTemplate: { findFirst: jest.fn().mockResolvedValue(row()) } };
    const handler = new GetContentTemplateByIdHandler(prisma);
    await handler.execute(new GetContentTemplateByIdQuery('t1'));
    expect(prisma.contentTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
