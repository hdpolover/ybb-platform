// services/api/src/modules/brands/presentation/signature-admin.controller.spec.ts
//
// /admin/signatures carried only @Roles, so any admin could list, create, edit
// or delete any brand's LOA signatures by brandId/id. Each route now checks the
// brand server-side before the bus is touched, and the writes also need the
// documents permission set (documents:write / program:write; content:write is not enough).
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { SignatureAdminController } from './signature-admin.controller';
import { CreateSignatureDto } from './dto/signature.dto';

const BASE = { canManageAdmins: false, canAssignRoles: false, customPermissions: [], role: { name: 'admin', permissions: ['documents:write'] } };
const BRAND_ADMIN = { ...BASE, accessLevel: 3, adminBrands: [{ brandId: 'brand-a', permissions: [] }], adminPrograms: [] };
const ASSIGNED_ADMIN = { ...BASE, accessLevel: 1, adminBrands: [], adminPrograms: [{ programId: 'prog-a', permissions: [] }] };
// brand_scope over brand-x only, plus an explicit extra grant on prog-a (brand-a).
const BRAND_ADMIN_WITH_EXTRA = { ...BASE, accessLevel: 3, adminBrands: [{ brandId: 'brand-x', permissions: [] }], adminPrograms: [{ programId: 'prog-a', permissions: [] }] };
const PLATFORM_ADMIN = { ...BASE, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] }, adminBrands: [], adminPrograms: [] };
// Prod "Admin" role: platform tier through platform_access, none of the documents set.
const PLATFORM_ACCESS_ADMIN = { ...BASE, accessLevel: 1, role: { name: 'Admin', permissions: ['platform_access'] }, adminBrands: [], adminPrograms: [] };

describe('SignatureAdminController brand scope', () => {
  const queryBus = { execute: jest.fn().mockResolvedValue([]) };
  const commandBus = { execute: jest.fn().mockResolvedValue({}) };
  const prisma = { signature: { findFirst: jest.fn() } };
  const readPrisma = {
    admin: { findUnique: jest.fn() },
    // prog-a lives in brand-a; nothing assigned lives anywhere else.
    program: {
      count: jest.fn(({ where }: { where: { id: { in: string[] }; brandId: string } }) =>
        Promise.resolve(where.id.in.includes('prog-a') && where.brandId === 'brand-a' ? 1 : 0),
      ),
      findMany: jest.fn(({ where }: { where: { id: { in: string[] }; brandId: string } }) =>
        Promise.resolve(where.id.in.includes('prog-a') && where.brandId === 'brand-a' ? [{ id: 'prog-a' }] : []),
      ),
    },
  };
  const controller = new SignatureAdminController(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
    prisma as unknown as PrismaService,
    readPrisma as unknown as PrismaReadService,
  );

  const req = () => ({ user: { adminId: 'admin-1' } });
  const dto = (brandId: string) => ({ brandId, name: 'Sig', imageUrl: 'https://x/y.png' }) as CreateSignatureDto;
  const as = (admin: object) => readPrisma.admin.findUnique.mockResolvedValue(admin);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.signature.findFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'sig-missing' ? null : { brandId: where.id === 'sig-a' ? 'brand-a' : 'brand-b' }),
    );
  });

  describe.each([
    ['brand-scoped', BRAND_ADMIN],
    ['assigned', ASSIGNED_ADMIN],
    ['brand-scoped with an extra program grant', BRAND_ADMIN_WITH_EXTRA],
  ])('%s admin', (_label, admin) => {
    beforeEach(() => as(admin));

    it('list/create on another brand: 403, bus never reached', async () => {
      await expect(controller.list('brand-b', req())).rejects.toThrow(ForbiddenException);
      await expect(controller.create(dto('brand-b'), req())).rejects.toThrow(ForbiddenException);
      expect(queryBus.execute).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it("update/delete another brand's signature: 404 like missing, bus never reached", async () => {
      await expect(controller.update('sig-b', {}, req())).rejects.toThrow(NotFoundException);
      await expect(controller.remove('sig-b', req())).rejects.toThrow(NotFoundException);
      await expect(controller.remove('sig-missing', req())).rejects.toThrow(NotFoundException);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('in its own brand: every route passes', async () => {
      await controller.list('brand-a', req());
      await controller.create(dto('brand-a'), req());
      await controller.update('sig-a', {}, req());
      await controller.remove('sig-a', req());
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe.each([
    ['brand-scoped', BRAND_ADMIN],
    ['assigned', ASSIGNED_ADMIN],
    ['brand-scoped with an extra program grant', BRAND_ADMIN_WITH_EXTRA],
  ])('%s admin without a documents write permission (Reviewer)', (_label, admin) => {
    beforeEach(() => as({ ...admin, role: { name: 'Reviewer', permissions: ['applications:write', 'review:write'] } }));

    it('in its own brand: list passes, create/update/delete 403, bus never reached for writes', async () => {
      await controller.list('brand-a', req());
      await expect(controller.create(dto('brand-a'), req())).rejects.toThrow(ForbiddenException);
      await expect(controller.update('sig-a', {}, req())).rejects.toThrow(ForbiddenException);
      await expect(controller.remove('sig-a', req())).rejects.toThrow(ForbiddenException);
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it("another brand's signature still 404s (scope before permission)", async () => {
      await expect(controller.update('sig-b', {}, req())).rejects.toThrow(NotFoundException);
    });
  });

  it('a grant of program:write on the program in that brand is enough', async () => {
    as({ ...ASSIGNED_ADMIN, role: { name: 'Scoped', permissions: [] }, adminPrograms: [{ programId: 'prog-a', permissions: ['program:write'] }] });
    await controller.create(dto('brand-a'), req());
    await controller.update('sig-a', {}, req());
    expect(commandBus.execute).toHaveBeenCalledTimes(2);
  });

  it('content:write alone cannot edit signatures (LOA documents are not content)', async () => {
    as({ ...ASSIGNED_ADMIN, role: { name: 'News Writer', permissions: ['content:write'] } });
    await expect(controller.update('sig-a', {}, req())).rejects.toThrow(ForbiddenException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('brand-scoped admin in its own brand never needs the program lookup', async () => {
    as(BRAND_ADMIN);
    await controller.list('brand-a', req());
    expect(readPrisma.program.count).not.toHaveBeenCalled();
  });

  it.each([['super admin', PLATFORM_ADMIN], ['platform_access', PLATFORM_ACCESS_ADMIN]])('%s passes on any brand and leaves not-found to the handler', async (_label, admin) => {
    as(admin);
    await controller.list('brand-b', req());
    await controller.create(dto('brand-b'), req());
    await controller.update('sig-b', {}, req());
    await controller.remove('sig-missing', req());
    expect(prisma.signature.findFirst).not.toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledTimes(3);
  });

  it('reads signature ownership from the primary, not the replica', async () => {
    as(BRAND_ADMIN);
    await controller.update('sig-a', {}, req());
    expect(prisma.signature.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sig-a', deletedAt: null } }));
  });
});
