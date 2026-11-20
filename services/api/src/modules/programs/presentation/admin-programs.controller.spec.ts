// services/api/src/modules/programs/presentation/admin-programs.controller.spec.ts
import { ExecutionContext, NotFoundException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { AdminProgramsController } from './admin-programs.controller';
import { SetFundingDecisionDto } from './dto/funding-decision.dto';

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const APP_ID = '22222222-2222-4222-8222-222222222222';

describe('AdminProgramsController.setFundingDecision', () => {
    const updateMany = jest.fn();
    const controller = new AdminProgramsController({ participantApplication: { updateMany } } as never);

    beforeEach(() => {
        updateMany.mockReset().mockResolvedValue({ count: 3 });
    });

    it('only targets submitted, fully funded, live applications of the URL program', async () => {
        const result = await controller.setFundingDecision(PROGRAM_ID, { applicationIds: [APP_ID], decision: 'awarded' });

        expect(result).toEqual({ updated: 3 });
        expect(updateMany).toHaveBeenCalledWith({
            where: {
                id: { in: [APP_ID] },
                programId: PROGRAM_ID,
                applicationCategory: 'fully_funded',
                status: { not: 'draft' },
                deletedAt: null,
            },
            data: { fundingDecision: 'awarded', fundingDecidedAt: expect.any(Date) },
        });
    });

    it('clears both columns when decision is null', async () => {
        await controller.setFundingDecision(PROGRAM_ID, { applicationIds: [APP_ID], decision: null });

        expect(updateMany.mock.calls[0][0].data).toEqual({ fundingDecision: null, fundingDecidedAt: null });
    });
});

describe('SetFundingDecisionDto validation', () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const validate = (body: unknown) =>
        pipe.transform(body, { type: 'body', metatype: SetFundingDecisionDto });

    it('accepts awarded, not_awarded and null', async () => {
        for (const decision of ['awarded', 'not_awarded', null]) {
            await expect(validate({ applicationIds: [APP_ID], decision })).resolves.toBeDefined();
        }
    });

    it('rejects a missing decision key', async () => {
        await expect(validate({ applicationIds: [APP_ID] })).rejects.toThrow();
    });

    it('rejects an unknown decision', async () => {
        await expect(validate({ applicationIds: [APP_ID], decision: 'rejected' })).rejects.toThrow();
    });

    it('rejects an empty, oversized, duplicated or non-uuid id list', async () => {
        const tooMany = Array.from({ length: 1001 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
        await expect(validate({ applicationIds: [], decision: 'awarded' })).rejects.toThrow();
        await expect(validate({ applicationIds: tooMany, decision: 'awarded' })).rejects.toThrow();
        await expect(validate({ applicationIds: [APP_ID, APP_ID], decision: 'awarded' })).rejects.toThrow();
        await expect(validate({ applicationIds: ['nope'], decision: 'awarded' })).rejects.toThrow();
    });
});

// GET :id used to carry only RolesGuard, so any admin could read any program by id.
// Real AdminScopeGuard + real route metadata: fails if the decorators are dropped.
describe('AdminProgramsController.findOneForAdmin scope (real AdminScopeGuard)', () => {
  const OTHER_PROGRAM_ID = '33333333-3333-4333-8333-333333333333';
  const base = {
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'admin', permissions: [] },
    adminBrands: [{ brandId: 'brand-a', permissions: [] }],
    adminPrograms: [] as Array<{ programId: string; permissions: string[] }>,
  };
  const ASSIGNED = { ...base, adminPrograms: [{ programId: PROGRAM_ID, permissions: [] }] };
  const PLATFORM = { ...base, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] } };

  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);
  const handler = AdminProgramsController.prototype.findOneForAdmin;

  const contextFor = (id: string) =>
    ({
      getHandler: () => handler,
      getClass: () => AdminProgramsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { adminId: 'admin-1' }, params: { id } }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaRead.program.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, brandId: 'brand-a', name: 'P', deletedAt: null }),
    );
  });

  it('runs AdminScopeGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(AdminScopeGuard);
  });

  it('lets an assigned admin read their program', async () => {
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED);
    await expect(guard.canActivate(contextFor(PROGRAM_ID))).resolves.toBe(true);
  });

  it('refuses (404) an unassigned program, even one in the admin\'s own brand', async () => {
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED);
    await expect(guard.canActivate(contextFor(OTHER_PROGRAM_ID))).rejects.toThrow(NotFoundException);
  });

  it('lets a platform admin read any program, including soft-deleted ones', async () => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM);
    await expect(guard.canActivate(contextFor(OTHER_PROGRAM_ID))).resolves.toBe(true);
    expect(prismaRead.program.findUnique).not.toHaveBeenCalled();
  });
});
