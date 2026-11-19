// services/api/src/modules/brand-email/brand-email.controller.spec.ts
//
// Creating a program's Listmonk draft campaign was scope-only. It now also
// needs program:write, the same rule the dashboard uses to show the button.
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminPermissionGuard, ADMIN_PERMISSION_KEY } from '@shared/guards/admin-permission.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { BrandEmailController } from './brand-email.controller';

const handler = BrandEmailController.prototype.createDraftCampaign;
const admin = (permissions: string[]) => ({
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'Scoped', permissions },
  adminBrands: [],
  adminPrograms: [{ programId: 'prog-1', permissions: [] }],
});

function check(permissions: string[]): Promise<boolean> {
  const prismaRead = { admin: { findUnique: jest.fn().mockResolvedValue(admin(permissions)) }, program: { findUnique: jest.fn() } };
  const guard = new AdminPermissionGuard(new Reflector(), prismaRead as unknown as PrismaReadService);
  const context = {
    getHandler: () => handler,
    getClass: () => BrandEmailController,
    switchToHttp: () => ({ getRequest: () => ({ user: { adminId: 'admin-1' }, params: { id: 'prog-1' } }) }),
  };
  return guard.canActivate(context as never);
}

describe('BrandEmailController POST programs/:id/email-campaigns', () => {
  it('runs AdminPermissionGuard and requires program:write on :id', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(AdminPermissionGuard);
    expect(new Reflector().get(ADMIN_PERMISSION_KEY, handler)).toEqual({ anyOf: ['program:write'], paramName: 'id' });
  });

  it('refuses an in-scope admin without program:write', async () => {
    await expect(check(['content:write', 'announcements:write'])).rejects.toThrow(ForbiddenException);
  });

  it('lets program:write through', async () => {
    await expect(check(['program:write'])).resolves.toBe(true);
  });
});
