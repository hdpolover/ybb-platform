// services/api/src/modules/programs/presentation/__tests__/program-child-routes.scope.spec.ts
//
// Participation-info, exchange-rate and announcement admin routes carried only
// JwtAuthGuard + RolesGuard, so a brand- or programme-scoped admin could write
// any programme's participation info, exchange rate and announcements by id.
// Driven against the REAL scope resolver and AdminScopeGuard; only Prisma and
// the downstream handlers are faked.
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { ProgramParticipationController } from '../program-participation.controller';
import { ProgramExchangeRateController } from '../program-exchange-rate.controller';
import { ProgramAnnouncementsController } from '../program-announcements.controller';

const BRAND_ADMIN = {
  accessLevel: 3,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'News Writer', permissions: [] },
  adminBrands: [{ brandId: 'brand-a', permissions: [] }],
  adminPrograms: [],
};
const ASSIGNED_ADMIN = { ...BRAND_ADMIN, role: { name: 'Program Admin', permissions: [] }, adminBrands: [], adminPrograms: [{ programId: 'prog-a', permissions: [] }] };
const PLATFORM_ADMIN = { ...BRAND_ADMIN, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] }, adminBrands: [] };

function makePrismaRead() {
  return {
    admin: { findUnique: jest.fn() },
    program: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id, brandId: where.id === 'prog-a' ? 'brand-a' : 'brand-b', name: 'P', deletedAt: null }),
      ),
    },
    programParticipationInfo: { findUnique: jest.fn() },
    programAnnouncement: { findUnique: jest.fn() },
  };
}

// --- Routes whose param IS the programme id: real AdminScopeGuard -----------

describe('programme-keyed admin routes (real AdminScopeGuard)', () => {
  const prismaRead = makePrismaRead();
  const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);

  const routes: Array<[string, (...args: never[]) => unknown, object, string]> = [
    ['POST programs/:programId/participation-info', ProgramParticipationController.prototype.upsert, ProgramParticipationController, 'programId'],
    ['PUT programs/:programId/exchange-rate', ProgramExchangeRateController.prototype.updateExchangeRate, ProgramExchangeRateController, 'programId'],
    ['GET programs/:programId/exchange-rate/history', ProgramExchangeRateController.prototype.getExchangeRateHistory, ProgramExchangeRateController, 'programId'],
    ['POST programs/:id/announcements', ProgramAnnouncementsController.prototype.create, ProgramAnnouncementsController, 'id'],
  ];

  function contextFor(handler: (...args: never[]) => unknown, cls: object, params: Record<string, string>): ExecutionContext {
    const request = { user: { adminId: 'admin-1' }, params };
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it.each(routes)('%s: AdminScopeGuard is actually mounted', (_name, handler) => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(AdminScopeGuard);
  });

  it.each(routes)("%s: a brand-scoped admin is refused (404) on another brand's program", async (_name, handler, cls, param) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-b' }))).rejects.toThrow(NotFoundException);
  });

  it.each(routes)('%s: an assigned admin is refused (404) on a program they are not assigned to', async (_name, handler, cls, param) => {
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED_ADMIN);
    await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-b' }))).rejects.toThrow(NotFoundException);
  });

  it.each(routes)('%s: brand-scoped and assigned admins pass on their own program', async (_name, handler, cls, param) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-a' }))).resolves.toBe(true);
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED_ADMIN);
    await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-a' }))).resolves.toBe(true);
  });

  it.each(routes)('%s: a platform admin passes on any program', async (_name, handler, cls, param) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-b' }))).resolves.toBe(true);
  });
});

// --- Child-entity routes: programme resolved from the row ---------------------

describe('child-entity admin routes resolve the owning program from the row', () => {
  const prismaRead = makePrismaRead();
  const commandBus = { execute: jest.fn().mockResolvedValue('reached') };
  const handler = () => ({ execute: jest.fn().mockResolvedValue('reached') });
  const handlers = { list: handler(), get: handler(), create: handler(), update: handler(), delete: handler() };

  const participation = new ProgramParticipationController(
    commandBus as unknown as CommandBus,
    {} as QueryBus,
    prismaRead as unknown as PrismaReadService,
  );
  const announcements = new ProgramAnnouncementsController(
    handlers.list as never,
    handlers.get as never,
    handlers.create as never,
    handlers.update as never,
    handlers.delete as never,
    prismaRead as unknown as PrismaReadService,
  );

  const req = () => ({ user: { id: 'user-1', userId: 'user-1', adminId: 'admin-1' } }) as never;

  // The route's programId is deliberately 'prog-a' (in scope) on the
  // participation delete: the row's own programme must be what is checked.
  const routes: Array<[string, () => Promise<unknown>, () => jest.Mock, string]> = [
    ['DELETE programs/:programId/participation-info/:id', () => participation.delete('prog-a', 'row-1', req()), () => commandBus.execute, 'Participation Info not found'],
    ['GET programs/announcements/:itemId', () => announcements.getOne('row-1', req()), () => handlers.get.execute, 'Announcement row-1 not found'],
    ['PUT programs/announcements/:itemId', () => announcements.update('row-1', {} as never, req()), () => handlers.update.execute, 'Announcement row-1 not found'],
    ['DELETE programs/announcements/:itemId', () => announcements.delete('row-1', req()), () => handlers.delete.execute, 'Announcement row-1 not found'],
  ];

  function rowIn(programId: string | null) {
    const row = programId ? { programId } : null;
    prismaRead.programParticipationInfo.findUnique.mockResolvedValue(row);
    prismaRead.programAnnouncement.findUnique.mockResolvedValue(row);
  }

  beforeEach(() => jest.clearAllMocks());

  it.each(routes)("%s: a brand-scoped admin gets 404 on another brand's row and nothing runs", async (_name, call, probe, message) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    rowIn('prog-b');
    await expect(call()).rejects.toThrow(new NotFoundException(message));
    expect(probe()).not.toHaveBeenCalled();
  });

  it.each(routes)('%s: an assigned admin gets 404 on an unassigned program row and nothing runs', async (_name, call, probe, message) => {
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED_ADMIN);
    rowIn('prog-b');
    await expect(call()).rejects.toThrow(new NotFoundException(message));
    expect(probe()).not.toHaveBeenCalled();
  });

  it.each(routes)('%s: a missing row answers the same 404', async (_name, call, probe, message) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    rowIn(null);
    await expect(call()).rejects.toThrow(new NotFoundException(message));
    expect(probe()).not.toHaveBeenCalled();
  });

  it.each(routes)('%s: scoped admins pass on a row in their own program', async (_name, call, probe) => {
    rowIn('prog-a');
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(call()).resolves.toBe('reached');
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED_ADMIN);
    await expect(call()).resolves.toBe('reached');
    expect(probe()).toHaveBeenCalledTimes(2);
  });

  it.each(routes)('%s: a platform admin passes on any row', async (_name, call, probe) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    rowIn('prog-b');
    await expect(call()).resolves.toBe('reached');
    expect(probe()).toHaveBeenCalledTimes(1);
  });

  describe('GET programs/:id/announcements (public list)', () => {
    const ADMIN_USER: CurrentUserData = { userId: 'user-1', email: 'a@test.com', brandId: 'brand-a', role: ['admin'], adminId: 'admin-1' };
    const isAdminArg = () => handlers.list.execute.mock.calls[0][0].isAdmin;

    it('an anonymous caller gets the public view without any admin lookup', async () => {
      await announcements.list('prog-b', {} as never, { user: undefined } as never, undefined);
      expect(isAdminArg()).toBe(false);
      expect(prismaRead.admin.findUnique).not.toHaveBeenCalled();
    });

    it("a brand-scoped admin gets only the public view of another brand's program", async () => {
      prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
      await announcements.list('prog-b', {} as never, req(), ADMIN_USER);
      expect(isAdminArg()).toBe(false);
    });

    it('a brand-scoped admin gets the admin view of their own program', async () => {
      prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
      await announcements.list('prog-a', {} as never, req(), ADMIN_USER);
      expect(isAdminArg()).toBe(true);
    });

    it('a platform admin gets the admin view of any program', async () => {
      prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
      await announcements.list('prog-b', {} as never, req(), ADMIN_USER);
      expect(isAdminArg()).toBe(true);
    });
  });
});
