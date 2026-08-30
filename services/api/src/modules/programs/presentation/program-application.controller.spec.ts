import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProgramApplicationConfigController } from './program-application.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
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

    // Function to create providers list
    const createMockProviders = () => {
        const handlers = [
            ListProgramPricingTiersHandler, GetPricingTierByIdHandler, GetPricingTierAlertsHandler, ListProgramRequirementsHandler,
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
            ],
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<ProgramApplicationConfigController>(ProgramApplicationConfigController);
        jest.clearAllMocks();
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
