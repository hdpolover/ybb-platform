// services/api/src/modules/programs/application/commands/handlers/content-template.handler.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CreateContentTemplateHandler,
  UpdateContentTemplateHandler,
  DeleteContentTemplateHandler,
} from './content-template.handler';
import {
  CreateContentTemplateCommand,
  UpdateContentTemplateCommand,
  DeleteContentTemplateCommand,
} from '../content-template.commands';
import { ProgramCopierRegistry } from '../../copy/program-copier.registry';

// Brief defect (same class as this plan's P2-R2, e.g.
// program-details.copier.spec.ts): NestJS's BadRequestException({code,
// message}) puts only `message` into `.message`; Jest's toThrow(regex)
// matches `.message` only, so `.rejects.toThrow(/some_code/)` can never
// match. `err.getResponse().code` is this codebase's established way to
// assert a structured exception's code. Fixing the TEST only here, per this
// task's pre-authorised fix instruction.
async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

function mkPrisma(overrides: Partial<{ existing: any }> = {}) {
  const base: any = {
    contentTemplate: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'new-id', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(overrides.existing ?? null),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  return base;
}

function mkRegistry(exportTemplate: jest.Mock) {
  return { get: jest.fn().mockReturnValue({ key: 'faqs', exportTemplate }) } as unknown as ProgramCopierRegistry;
}

describe('CreateContentTemplateHandler', () => {
  it('derives the payload via registry.get(entityType).exportTemplate, validates it, and persists', async () => {
    const exportTemplate = jest.fn().mockResolvedValue({
      entityType: 'faqs',
      payloadVersion: 1,
      items: [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }],
    });
    const prisma = mkPrisma();
    const handler = new CreateContentTemplateHandler(prisma, mkRegistry(exportTemplate));
    const result = await handler.execute(
      new CreateContentTemplateCommand({ entityType: 'faqs', programId: 'src', name: 'Standard FAQs', isDefault: false }),
    );
    expect(exportTemplate).toHaveBeenCalledWith('src', undefined);
    expect(prisma.contentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Standard FAQs', entityType: 'faqs', isDefault: false, payloadVersion: 1 }),
      }),
    );
    expect(result.id).toBe('new-id');
  });

  it('rejects a payload that fails schema validation, before persisting', async () => {
    const exportTemplate = jest.fn().mockResolvedValue({ entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?' }] });
    const prisma = mkPrisma();
    const handler = new CreateContentTemplateHandler(prisma, mkRegistry(exportTemplate));
    const err = await captureError(
      handler.execute(new CreateContentTemplateCommand({ entityType: 'faqs', programId: 'src', name: 'Bad' })),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('invalid_template_payload');
    expect(prisma.contentTemplate.create).not.toHaveBeenCalled();
  });

  // Deliberate design decision, not in the original brief (see this task's
  // "known open question"): program-details.copier.ts's exportTemplate has
  // no blank-content guard (unlike its own copy()/applyTemplate, and unlike
  // every list copier's empty_replace_source guard), so an all-blank source
  // program would otherwise save a template that applyTemplate can then
  // NEVER apply (it always throws empty_replace_source on that entityType).
  // A zero-item payload is the same failure shape for every OTHER
  // entityType too (e.g. a faqs export against a program with zero FAQs) —
  // generically useless, and the failure would otherwise surface later, at
  // apply time, on a different program. Reject it here, before any
  // mutation, rather than let it get stored. This does not fully close the
  // program-details gap (that copier always exports exactly one item,
  // regardless of blankness — see this task's report for the residual
  // gap), but it does close it for every entityType where "no content" and
  // "zero items" are the same thing.
  it('rejects an empty payload (zero items), before any mutation, even when isDefault is true', async () => {
    const exportTemplate = jest.fn().mockResolvedValue({ entityType: 'faqs', payloadVersion: 1, items: [] });
    const prisma = mkPrisma();
    const handler = new CreateContentTemplateHandler(prisma, mkRegistry(exportTemplate));
    const err = await captureError(
      handler.execute(new CreateContentTemplateCommand({ entityType: 'faqs', programId: 'src', name: 'Empty', isDefault: true })),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('empty_template_payload');
    expect(prisma.contentTemplate.updateMany).not.toHaveBeenCalled();
    expect(prisma.contentTemplate.create).not.toHaveBeenCalled();
  });

  it('when isDefault is true, unsets isDefault on every other template of the SAME entityType only', async () => {
    // Non-empty items: this test exercises isDefault scoping, not the
    // empty-payload guard above — the brief's original fixture used
    // `items: []`, which the guard now deliberately rejects before reaching
    // updateMany. Swapped in one valid item so this test still isolates
    // what it says it tests.
    const exportTemplate = jest.fn().mockResolvedValue({
      entityType: 'faqs',
      payloadVersion: 1,
      items: [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }],
    });
    const prisma = mkPrisma();
    const handler = new CreateContentTemplateHandler(prisma, mkRegistry(exportTemplate));
    await handler.execute(new CreateContentTemplateCommand({ entityType: 'faqs', programId: 'src', name: 'New Default', isDefault: true }));
    expect(prisma.contentTemplate.updateMany).toHaveBeenCalledWith({
      where: { entityType: 'faqs', isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  });
});

describe('UpdateContentTemplateHandler', () => {
  it('throws NotFoundException when the template does not exist or is soft-deleted', async () => {
    const prisma = mkPrisma({ existing: null });
    const handler = new UpdateContentTemplateHandler(prisma);
    await expect(handler.execute(new UpdateContentTemplateCommand('missing', { name: 'x' }))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates name/description/isDefault only — payload is never touched', async () => {
    const prisma = mkPrisma({ existing: { id: 't1', entityType: 'faqs', isDefault: false } });
    const handler = new UpdateContentTemplateHandler(prisma);
    await handler.execute(new UpdateContentTemplateCommand('t1', { name: 'Renamed' }));
    expect(prisma.contentTemplate.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { name: 'Renamed' } });
  });

  it('unsets isDefault on other templates of the same entityType, excluding itself, when set true', async () => {
    const prisma = mkPrisma({ existing: { id: 't1', entityType: 'faqs', isDefault: false } });
    const handler = new UpdateContentTemplateHandler(prisma);
    await handler.execute(new UpdateContentTemplateCommand('t1', { isDefault: true }));
    expect(prisma.contentTemplate.updateMany).toHaveBeenCalledWith({
      where: { entityType: 'faqs', isDefault: true, deletedAt: null, NOT: { id: 't1' } },
      data: { isDefault: false },
    });
  });
});

describe('DeleteContentTemplateHandler', () => {
  it('throws NotFoundException when the template does not exist or is already soft-deleted', async () => {
    const prisma = mkPrisma({ existing: null });
    const handler = new DeleteContentTemplateHandler(prisma as any);
    await expect(handler.execute(new DeleteContentTemplateCommand('missing'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes by setting deletedAt', async () => {
    const prisma = mkPrisma({ existing: { id: 't1' } });
    const handler = new DeleteContentTemplateHandler(prisma as any);
    await handler.execute(new DeleteContentTemplateCommand('t1'));
    expect(prisma.contentTemplate.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { deletedAt: expect.any(Date) } });
  });
});
