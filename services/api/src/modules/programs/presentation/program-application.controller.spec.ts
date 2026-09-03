import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProgramApplicationConfigController } from './program-application.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import {
  CreateProgramPricingTierDto,
  UpdateProgramPricingTierDto,
} from './dto/create-update-program-content.dto';

import {
  ListProgramPricingTiersHandler,
  GetPricingTierByIdHandler,
  GetPricingTierAlertsHandler,
  ListProgramRequirementsHandler,
  ListProgramEssaysHandler,
  ListProgramParticipationCategoriesHandler,
  ListProgramSubthemesHandler,
} from '../application/queries/handlers/list-program-content.handlers';
import { GetPricingTierAlertsSummaryHandler } from '../application/queries/handlers/get-pricing-tier-alerts-summary.handler';
import { GetApplicationFormFieldsHandler } from '../application/queries/handlers/get-application-form-fields.handler';

import {
  CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
  CreateValidityPeriodHandler, UpdateValidityPeriodHandler, DeleteValidityPeriodHandler,
  CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
  CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler, UpdateProgramEssayGuidelinesHandler,
  CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
  CreateProgramSubthemeHandler, UpdateProgramSubthemeHandler, DeleteProgramSubthemeHandler,
} from '../application/commands/handlers/manage-program-content.handlers';
import {
  CreateApplicationFormFieldHandler,
  UpdateApplicationFormFieldHandler,
  DeleteApplicationFormFieldHandler,
} from '../application/commands/handlers/application-form-field.handler';

import { ListProgramPricingTiersQuery } from '../application/queries/list-program-content.queries';
import { CreateProgramPricingTierCommand } from '../application/commands/program-content.commands';

describe('ProgramApplicationConfigController', () => {
    let controller: ProgramApplicationConfigController;
    
    // Mocks
    const mockExecute = { execute: jest.fn() };

    // Backs the child-entity scope checks (pricing tier / validity period -> program).
    const mockReadPrisma = {
        admin: { findUnique: jest.fn() },
        program: { findUnique: jest.fn() },
        programPricingTier: { findUnique: jest.fn() },
        pricingTierValidityPeriod: { findUnique: jest.fn() },
    };

    // Function to create providers list
    const createMockProviders = () => {
        const handlers = [
            ListProgramPricingTiersHandler, GetPricingTierByIdHandler, GetPricingTierAlertsHandler, GetPricingTierAlertsSummaryHandler, ListProgramRequirementsHandler,
            ListProgramEssaysHandler, ListProgramParticipationCategoriesHandler, ListProgramSubthemesHandler,
            GetApplicationFormFieldsHandler,

            CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
            CreateValidityPeriodHandler, UpdateValidityPeriodHandler, DeleteValidityPeriodHandler,
            CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
            CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler, UpdateProgramEssayGuidelinesHandler,
            CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
            CreateProgramSubthemeHandler, UpdateProgramSubthemeHandler, DeleteProgramSubthemeHandler,

            CreateApplicationFormFieldHandler, UpdateApplicationFormFieldHandler, DeleteApplicationFormFieldHandler
        ];

        return handlers.map(handler => ({
            provide: handler,
            useValue: mockExecute
        }));
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProgramApplicationConfigController],
            providers: [
                ...createMockProviders(),
                { provide: 'IProgramRepository', useValue: { findById: jest.fn(), findBySlug: jest.fn() } },
                { provide: PrismaReadService, useValue: mockReadPrisma },
            ],
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(AdminScopeGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<ProgramApplicationConfigController>(ProgramApplicationConfigController);
        jest.clearAllMocks();
        // Default caller is a platform-scope (super) admin, so existing expectations hold.
        mockReadPrisma.admin.findUnique.mockResolvedValue({
            accessLevel: 10,
            canManageAdmins: true,
            canAssignRoles: true,
            customPermissions: [],
            role: { name: 'super admin', permissions: ['*'] },
            adminBrands: [],
            adminPrograms: [],
        });
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getPricingTiers', () => {
        it('should execute ListProgramPricingTiersQuery', async () => {
            const programId = 'prog-1';
            await controller.getPricingTiers(programId);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(ListProgramPricingTiersQuery));
            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.programId).toBe(programId);
        });
    });

    describe('updatePricingTier scope', () => {
        // Fresh per test: the resolved scope is memoized onto the request object.
        const newReq = () => ({ user: { id: 'admin-1', adminId: 'admin-1' } }) as any;

        it('resolves the owning program from the tier row, not from the request body', async () => {
            mockReadPrisma.programPricingTier.findUnique.mockResolvedValue({ programId: 'prog-owner' });
            mockReadPrisma.program.findUnique.mockResolvedValue({
                id: 'prog-owner',
                brandId: 'brand-1',
                name: 'Owner',
                deletedAt: null,
            });

            await controller.updatePricingTier('tier-1', { programId: 'prog-i-can-reach' } as any, newReq());

            expect(mockReadPrisma.programPricingTier.findUnique).toHaveBeenCalledWith({
                where: { id: 'tier-1' },
                select: { programId: true },
            });
            expect(mockExecute.execute).toHaveBeenCalled();
        });

        it('refuses a tier whose program is outside the caller’s assignments', async () => {
            mockReadPrisma.admin.findUnique.mockResolvedValue({
                accessLevel: 1,
                canManageAdmins: false,
                canAssignRoles: false,
                customPermissions: [],
                role: { name: 'admin', permissions: [] },
                adminBrands: [],
                adminPrograms: [{ programId: 'prog-mine', permissions: [] }],
            });
            mockReadPrisma.programPricingTier.findUnique.mockResolvedValue({ programId: 'prog-theirs' });
            mockReadPrisma.program.findUnique.mockResolvedValue({
                id: 'prog-theirs',
                brandId: 'brand-1',
                name: 'Theirs',
                deletedAt: null,
            });

            await expect(controller.updatePricingTier('tier-1', {} as any, newReq())).rejects.toThrow(NotFoundException);
            expect(mockExecute.execute).not.toHaveBeenCalled();
        });
    });

    describe('addPricingTier', () => {
        it('should execute CreateProgramPricingTierCommand', async () => {
            const dto = {
                programId: 'prog-1',
                name: 'Standard',
                usdPrice: 100,
                idrPrice: 1500000,
                description: 'Standard Access',
                validFrom: new Date().toISOString(),
                validUntil: new Date().toISOString()
            };
            const req = { user: { id: 'admin-1' } } as any;

            await controller.addPricingTier('prog-1', dto, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateProgramPricingTierCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.dto).toBe(dto);
            expect(cmd.userId).toBe('admin-1');
        });
    });
});

describe('Pricing tier dual-price validation', () => {
    const validBaseFields = {
        programId: '11111111-1111-1111-1111-111111111111',
        name: 'Test Tier',
        validFrom: '2026-04-15T00:00:00Z',
        validUntil: '2026-10-11T00:00:00Z',
    };

    describe('CreateProgramPricingTierDto', () => {
        it('passes with valid usdPrice and idrPrice', async () => {
            const dto = plainToInstance(CreateProgramPricingTierDto, {
                ...validBaseFields,
                usdPrice: 15.0,
                idrPrice: 250000,
            });
            const errors = await validate(dto);
            const dualPriceErrors = errors.filter(
                (e) => e.property === 'usdPrice' || e.property === 'idrPrice',
            );
            expect(dualPriceErrors).toEqual([]);
        });

        it('rejects negative usdPrice', async () => {
            const dto = plainToInstance(CreateProgramPricingTierDto, {
                ...validBaseFields,
                usdPrice: -1,
                idrPrice: 250000,
            });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'usdPrice')).toBe(true);
        });

        it('rejects zero usdPrice (below the 0.01 floor)', async () => {
            const dto = plainToInstance(CreateProgramPricingTierDto, {
                ...validBaseFields,
                usdPrice: 0,
                idrPrice: 250000,
            });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'usdPrice')).toBe(true);
        });

        it('rejects fractional idrPrice', async () => {
            const dto = plainToInstance(CreateProgramPricingTierDto, {
                ...validBaseFields,
                usdPrice: 10,
                idrPrice: 250000.5,
            });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'idrPrice')).toBe(true);
        });

        it('rejects zero idrPrice', async () => {
            const dto = plainToInstance(CreateProgramPricingTierDto, {
                ...validBaseFields,
                usdPrice: 10,
                idrPrice: 0,
            });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'idrPrice')).toBe(true);
        });

        it('rejects missing usdPrice', async () => {
            const dto = plainToInstance(CreateProgramPricingTierDto, {
                ...validBaseFields,
                idrPrice: 250000,
            });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'usdPrice')).toBe(true);
        });

        it('rejects missing idrPrice', async () => {
            const dto = plainToInstance(CreateProgramPricingTierDto, {
                ...validBaseFields,
                usdPrice: 10,
            });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'idrPrice')).toBe(true);
        });
    });

    describe('UpdateProgramPricingTierDto', () => {
        it('passes when only usdPrice is provided', async () => {
            const dto = plainToInstance(UpdateProgramPricingTierDto, { usdPrice: 20 });
            const errors = await validate(dto);
            expect(errors).toEqual([]);
        });

        it('passes with both fields valid', async () => {
            const dto = plainToInstance(UpdateProgramPricingTierDto, {
                usdPrice: 20,
                idrPrice: 300000,
            });
            const errors = await validate(dto);
            expect(errors).toEqual([]);
        });

        it('rejects negative usdPrice on update', async () => {
            const dto = plainToInstance(UpdateProgramPricingTierDto, { usdPrice: -5 });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'usdPrice')).toBe(true);
        });

        it('rejects fractional idrPrice on update', async () => {
            const dto = plainToInstance(UpdateProgramPricingTierDto, { idrPrice: 100.5 });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'idrPrice')).toBe(true);
        });
    });
});
