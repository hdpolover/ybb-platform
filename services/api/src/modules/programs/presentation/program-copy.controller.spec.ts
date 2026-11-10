// services/api/src/modules/programs/presentation/program-copy.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ProgramCopyController } from './program-copy.controller';
import { ProgramCopierRegistry } from '../application/copy/program-copier.registry';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../brands/application/services/landing-cache-invalidation.service';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import * as manageProgramContentHandlers from '../application/commands/handlers/manage-program-content.handlers';

// Fix 2: invalidateLandingCacheByProgramId is a plain exported function
// (not a DI-injected service), so it's mocked at the module level rather
// than via a Nest provider override.
jest.mock('../application/commands/handlers/manage-program-content.handlers', () => ({
  ...jest.requireActual('../application/commands/handlers/manage-program-content.handlers'),
  invalidateLandingCacheByProgramId: jest.fn().mockResolvedValue(undefined),
}));

const CALLER = { userId: 'user-1', email: 'admin@example.com', brandId: 'brand-1', adminId: 'admin-1' };
const ADMIN_ROW = {
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'reviewer', permissions: ['review:write'] },
  adminBrands: [],
  adminPrograms: [],
};
const PROGRAM_WRITER = { ...ADMIN_ROW, role: { name: 'admin', permissions: ['program:write'] } };

describe('ProgramCopyController', () => {
  let controller: ProgramCopyController;
  const mockRegistryGet = jest.fn();
  const mockPrismaTransaction = jest.fn();
  const mockLandingCacheInvalidation = { invalidate: jest.fn() };
  const mockAdminFindUnique = jest.fn();
  const mockPrismaRead = { admin: { findUnique: mockAdminFindUnique }, program: { findUnique: jest.fn() } };
  const mockInvalidateLandingCache = manageProgramContentHandlers.invalidateLandingCacheByProgramId as jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramCopyController],
      providers: [
        { provide: ProgramCopierRegistry, useValue: { get: mockRegistryGet, list: jest.fn() } },
        { provide: PrismaService, useValue: { $transaction: mockPrismaTransaction } },
        { provide: LandingCacheInvalidationService, useValue: mockLandingCacheInvalidation },
        { provide: PrismaReadService, useValue: mockPrismaRead },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProgramCopyController>(ProgramCopyController);
    jest.clearAllMocks();
    mockInvalidateLandingCache.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCounts', () => {
    it('calls countFor for each program id in the comma-separated query param', async () => {
      const countFor = jest.fn().mockImplementation((id: string) => Promise.resolve(id === 'p1' ? 3 : 0));
      mockRegistryGet.mockReturnValue({ countFor });
      const result = await controller.getCounts('faqs', 'p1,p2');
      expect(mockRegistryGet).toHaveBeenCalledWith('faqs');
      expect(result).toEqual([
        { programId: 'p1', count: 3 },
        { programId: 'p2', count: 0 },
      ]);
    });

    it('returns an empty array when programIds is missing', async () => {
      mockRegistryGet.mockReturnValue({ countFor: jest.fn() });
      const result = await controller.getCounts('faqs', undefined);
      expect(result).toEqual([]);
    });
  });

  describe('preview', () => {
    it('delegates to the copier registered under entityKey', async () => {
      const preview = jest.fn().mockResolvedValue([{ id: 'x', label: 'X' }]);
      mockRegistryGet.mockReturnValue({ preview });
      const result = await controller.preview('prog-1', 'faqs');
      expect(mockRegistryGet).toHaveBeenCalledWith('faqs');
      expect(preview).toHaveBeenCalledWith('prog-1');
      expect(result).toEqual([{ id: 'x', label: 'X' }]);
    });
  });

  describe('copy', () => {
    it('rejects when sourceProgramId equals the target programId', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.copy('prog-1', 'faqs', { sourceProgramId: 'prog-1', mode: 'append' }, CALLER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects replace mode without confirm: true', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'replace' }, CALLER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects append mode when the copier does not support it', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: false, copy: jest.fn() });
      await expect(
        controller.copy('tgt', 'program-details', { sourceProgramId: 'src', mode: 'append' }, CALLER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('opens a transaction and calls the copier with sourceProgramId/targetProgramId/itemIds/mode (no confirm)', async () => {
      const copy = jest.fn().mockResolvedValue({ created: 2, skipped: 1, replaced: 0 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.copy('tgt', 'faqs', {
        sourceProgramId: 'src',
        itemIds: ['a', 'b'],
        mode: 'append',
      }, CALLER);

      expect(copy).toHaveBeenCalledWith('fake-tx', {
        sourceProgramId: 'src',
        targetProgramId: 'tgt',
        itemIds: ['a', 'b'],
        mode: 'append',
      });
      expect(result).toEqual({ created: 2, skipped: 1, replaced: 0 });
    });

    it('accepts replace mode when confirm is true', async () => {
      const copy = jest.fn().mockResolvedValue({ created: 0, skipped: 0, replaced: 4 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'replace', confirm: true }, CALLER);

      expect(copy).toHaveBeenCalledWith('fake-tx', { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: undefined, mode: 'replace' });
      expect(result).toEqual({ created: 0, skipped: 0, replaced: 4 });
    });

    // Fix 2: @CacheInvalidate only busts Redis-pattern caches, it cannot
    // delete brand_landing_snapshots rows — the public FAQ (and other
    // landing) pages read through that snapshot and would otherwise keep
    // serving stale data after a copy. Proves the controller reuses the
    // same helper the single-item content handlers already call, with the
    // target programId, after the transaction has resolved.
    it('invalidates the landing cache for the target program after a successful copy', async () => {
      const copy = jest.fn().mockResolvedValue({ created: 1, skipped: 0, replaced: 0 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      await controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'append' }, CALLER);

      expect(mockInvalidateLandingCache).toHaveBeenCalledTimes(1);
      expect(mockInvalidateLandingCache).toHaveBeenCalledWith('tgt', expect.anything(), mockLandingCacheInvalidation);
      // Ordering: the transaction must have already resolved before the
      // invalidation call fires (post-commit, not pre- or mid-transaction).
      const transactionOrder = mockPrismaTransaction.mock.invocationCallOrder[0];
      const invalidateOrder = mockInvalidateLandingCache.mock.invocationCallOrder[0];
      expect(invalidateOrder).toBeGreaterThan(transactionOrder);
    });

    it('does not invalidate the landing cache when the request is rejected before the transaction opens', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.copy('prog-1', 'faqs', { sourceProgramId: 'prog-1', mode: 'append' }, CALLER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockInvalidateLandingCache).not.toHaveBeenCalled();
    });
  });

  // A copier that declares requiredPermissions (scoring-rubric) must not be a
  // way around the permission gate on that entity's own write endpoint.
  describe('permission-gated copiers', () => {
    const gatedCopier = () => ({ supportsAppend: true, requiredPermissions: ['program:write'], copy: jest.fn(), applyTemplate: jest.fn() });

    it('copy: refuses a caller without the permission before any write', async () => {
      mockRegistryGet.mockReturnValue(gatedCopier());
      mockAdminFindUnique.mockResolvedValue(ADMIN_ROW);
      await expect(
        controller.copy('tgt', 'scoring-rubric', { sourceProgramId: 'src', mode: 'append' }, CALLER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('copy: lets a caller with the permission through', async () => {
      mockRegistryGet.mockReturnValue(gatedCopier());
      mockAdminFindUnique.mockResolvedValue(PROGRAM_WRITER);
      mockPrismaTransaction.mockResolvedValue({ created: 1, skipped: 0, replaced: 0 });
      await expect(
        controller.copy('tgt', 'scoring-rubric', { sourceProgramId: 'src', mode: 'append' }, CALLER),
      ).resolves.toEqual({ created: 1, skipped: 0, replaced: 0 });
    });

    it('copy: an ungated copier costs no permission lookup', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      mockPrismaTransaction.mockResolvedValue({ created: 0, skipped: 0, replaced: 0 });
      await controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'append' }, CALLER);
      expect(mockAdminFindUnique).not.toHaveBeenCalled();
    });

    it('applyTemplate: refuses a caller without the permission before reading the template', async () => {
      mockRegistryGet.mockReturnValue(gatedCopier());
      mockAdminFindUnique.mockResolvedValue(ADMIN_ROW);
      await expect(
        controller.applyTemplate('tgt', 'scoring-rubric', { templateId: 'tpl-1', mode: 'append' }, CALLER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('cloneFrom: one gated entity the caller cannot write refuses the whole clone', async () => {
      mockRegistryGet.mockImplementation((key: string) =>
        key === 'scoring-rubric' ? gatedCopier() : { supportsAppend: true, copy: jest.fn() },
      );
      mockAdminFindUnique.mockResolvedValue(ADMIN_ROW);
      await expect(
        controller.cloneFrom(
          'tgt',
          { sourceProgramId: 'src', entities: [{ key: 'faqs', mode: 'append' }, { key: 'scoring-rubric', mode: 'append' }] },
          CALLER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });
  });

  describe('applyTemplate', () => {
    const mockPrismaFindTemplate = jest.fn();
    const mockInvalidate = jest.fn().mockResolvedValue(undefined);

    beforeEach(() => {
      (controller as any).prisma.contentTemplate = { findFirst: mockPrismaFindTemplate };
      (controller as any).landingCacheInvalidation = { invalidate: mockInvalidate };
    });

    it('404s when the template does not exist', async () => {
      mockPrismaFindTemplate.mockResolvedValue(null);
      await expect(controller.applyTemplate('tgt', 'faqs', { templateId: 'missing', mode: 'append' }, CALLER)).rejects.toBeInstanceOf(NotFoundException);
      // The point of a guard test is that the mutation did not happen, not
      // merely that it threw — a guard firing after the write still throws.
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects when the template\'s entityType does not match the :entityKey in the URL', async () => {
      mockPrismaFindTemplate.mockResolvedValue({ id: 't1', entityType: 'timelines', payload: { entityType: 'timelines', payloadVersion: 1, items: [] } });
      await expect(controller.applyTemplate('tgt', 'faqs', { templateId: 't1', mode: 'append' }, CALLER)).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects replace mode without confirm: true', async () => {
      mockPrismaFindTemplate.mockResolvedValue({ id: 't1', entityType: 'faqs', payload: { entityType: 'faqs', payloadVersion: 1, items: [] } });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, applyTemplate: jest.fn() });
      await expect(controller.applyTemplate('tgt', 'faqs', { templateId: 't1', mode: 'replace' }, CALLER)).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('opens a transaction, calls copier.applyTemplate(tx, payload, programId, mode), then invalidates the landing cache', async () => {
      const payload = { entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }] };
      mockPrismaFindTemplate.mockResolvedValue({ id: 't1', entityType: 'faqs', payload });
      const applyTemplate = jest.fn().mockResolvedValue({ created: 1, skipped: 0, replaced: 0 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, applyTemplate });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.applyTemplate('tgt', 'faqs', { templateId: 't1', mode: 'append' }, CALLER);

      expect(applyTemplate).toHaveBeenCalledWith('fake-tx', payload, 'tgt', 'append');
      expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
      // invalidateLandingCacheByProgramId is mocked at the module level (see
      // the jest.mock at the top of this file), so it never calls through
      // to the local `landingCacheInvalidation.invalidate` mock assigned
      // above — assert on the module-level mock instead, same as copy()'s
      // own cache-invalidation test does.
      expect(mockInvalidateLandingCache).toHaveBeenCalled();
    });
  });

  describe('getRegistry', () => {
    it('returns key/label/supportsAppend/count for every registered copier against the given program', async () => {
      const faqsCountFor = jest.fn().mockResolvedValue(3);
      const timelinesCountFor = jest.fn().mockResolvedValue(0);
      (controller as any).registry.list = jest.fn().mockReturnValue([
        { key: 'faqs', label: 'FAQs', supportsAppend: true, countFor: faqsCountFor },
        { key: 'timelines', label: 'Timelines', supportsAppend: true, countFor: timelinesCountFor },
      ]);
      const result = await controller.getRegistry('src');
      expect(faqsCountFor).toHaveBeenCalledWith('src');
      expect(result).toEqual([
        { key: 'faqs', label: 'FAQs', supportsAppend: true, count: 3 },
        { key: 'timelines', label: 'Timelines', supportsAppend: true, count: 0 },
      ]);
    });
  });

  describe('cloneFrom', () => {
    it('rejects when sourceProgramId equals the target :id', async () => {
      await expect(
        controller.cloneFrom('prog-1', { sourceProgramId: 'prog-1', entities: [{ key: 'faqs', mode: 'append' }] }, CALLER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects when any entity requests replace without top-level confirmReplace: true', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.cloneFrom('tgt', { sourceProgramId: 'src', entities: [{ key: 'faqs', mode: 'replace' }] }, CALLER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects an entity requesting append on a copier that does not support it', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: false, copy: jest.fn() });
      await expect(
        controller.cloneFrom('tgt', { sourceProgramId: 'src', entities: [{ key: 'program-details', mode: 'append' }] }, CALLER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('runs every selected copier\'s copy() inside ONE transaction and returns results keyed by entity key', async () => {
      const faqsCopy = jest.fn().mockResolvedValue({ created: 2, skipped: 0, replaced: 0 });
      const timelinesCopy = jest.fn().mockResolvedValue({ created: 1, skipped: 1, replaced: 0 });
      mockRegistryGet.mockImplementation((key: string) =>
        key === 'faqs' ? { supportsAppend: true, copy: faqsCopy } : { supportsAppend: true, copy: timelinesCopy },
      );
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.cloneFrom('tgt', {
        sourceProgramId: 'src',
        entities: [{ key: 'faqs', mode: 'append' }, { key: 'timelines', mode: 'append' }],
      }, CALLER);

      expect(faqsCopy).toHaveBeenCalledWith('fake-tx', { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: undefined, mode: 'append' });
      expect(timelinesCopy).toHaveBeenCalledWith('fake-tx', { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: undefined, mode: 'append' });
      expect(result).toEqual({ faqs: { created: 2, skipped: 0, replaced: 0 }, timelines: { created: 1, skipped: 1, replaced: 0 } });
      // Both copiers ran through the SAME $transaction call — a single commit
      // for the whole batch, not one per entity.
      expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    });

    it('a copier throwing mid-batch propagates the error without swallowing it (so $transaction rolls everything back)', async () => {
      const faqsCopy = jest.fn().mockResolvedValue({ created: 1, skipped: 0, replaced: 0 });
      const timelinesCopy = jest.fn().mockRejectedValue(new Error('boom'));
      mockRegistryGet.mockImplementation((key: string) =>
        key === 'faqs' ? { supportsAppend: true, copy: faqsCopy } : { supportsAppend: true, copy: timelinesCopy },
      );
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      await expect(
        controller.cloneFrom('tgt', { sourceProgramId: 'src', entities: [{ key: 'faqs', mode: 'append' }, { key: 'timelines', mode: 'append' }] }, CALLER),
      ).rejects.toThrow('boom');
    });
  });
});

// Drives the REAL AdminScopeGuard against the real route metadata (only
// PrismaReadService is faked), so this fails if the decorators are dropped,
// point at the wrong param, or the guard stops refusing out-of-scope admins.
// Unit specs above stub the guard out and cannot see any of that.
describe('ProgramCopyController write-route scope enforcement (real AdminScopeGuard)', () => {
  const BRAND_ADMIN = {
    accessLevel: 3,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'admin', permissions: [] },
    adminBrands: [{ brandId: 'brand-a', permissions: [] }],
    adminPrograms: [],
  };
  const PLATFORM_ADMIN = { ...BRAND_ADMIN, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] }, adminBrands: [] };

  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);

  function contextFor(handler: (...args: never[]) => unknown, params: Record<string, string>): ExecutionContext {
    const request = { user: { adminId: 'admin-1' }, params };
    return {
      getHandler: () => handler,
      getClass: () => ProgramCopyController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  const routes: Array<[string, (...args: never[]) => unknown, Record<string, string>]> = [
    ['POST :programId/copy/:entityKey', ProgramCopyController.prototype.copy, { entityKey: 'scoring-rubric' }],
    ['POST :programId/copy/:entityKey/apply-template', ProgramCopyController.prototype.applyTemplate, { entityKey: 'scoring-rubric' }],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prismaRead.program.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, brandId: where.id === 'prog-a' ? 'brand-a' : 'brand-b', name: 'P', deletedAt: null }),
    );
  });

  it.each(routes)('%s: a brand-scoped admin is refused (404) on another brand\'s program', async (_name, handler, params) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { ...params, programId: 'prog-b' }))).rejects.toThrow(NotFoundException);
  });

  it.each(routes)('%s: a brand-scoped admin passes on a program in their own brand', async (_name, handler, params) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { ...params, programId: 'prog-a' }))).resolves.toBe(true);
  });

  it.each(routes)('%s: a platform admin passes on any program', async (_name, handler, params) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { ...params, programId: 'prog-b' }))).resolves.toBe(true);
  });
});

describe('ProgramCopyController clone-from scope enforcement (real AdminScopeGuard)', () => {
  const BRAND_ADMIN = {
    accessLevel: 3,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'admin', permissions: [] },
    adminBrands: [{ brandId: 'brand-a', permissions: [] }],
    adminPrograms: [],
  };
  const PLATFORM_ADMIN = { ...BRAND_ADMIN, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] }, adminBrands: [] };

  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);

  function contextFor(handler: (...args: never[]) => unknown, params: Record<string, string>): ExecutionContext {
    const request = { user: { adminId: 'admin-1' }, params };
    return {
      getHandler: () => handler,
      getClass: () => ProgramCopyController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  const routes: Array<[string, (...args: never[]) => unknown, Record<string, string>]> = [
    ['POST :id/clone-from', ProgramCopyController.prototype.cloneFrom, {}],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prismaRead.program.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, brandId: where.id === 'prog-a' ? 'brand-a' : 'brand-b', name: 'P', deletedAt: null }),
    );
  });

  it.each(routes)('%s: a brand-scoped admin is refused (404) on another brand\'s program', async (_name, handler, params) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { ...params, id: 'prog-b' }))).rejects.toThrow(NotFoundException);
  });

  it.each(routes)('%s: a brand-scoped admin passes on a program in their own brand', async (_name, handler, params) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { ...params, id: 'prog-a' }))).resolves.toBe(true);
  });

  it.each(routes)('%s: a platform admin passes on any program', async (_name, handler, params) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { ...params, id: 'prog-b' }))).resolves.toBe(true);
  });
});
