import { Test, TestingModule } from '@nestjs/testing';
import { ProgramApplicationConfigController } from './program-application.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';

import {
  ListProgramPricingTiersHandler,
  ListProgramRequirementsHandler,
  ListProgramEssaysHandler,
  ListProgramParticipationCategoriesHandler,
} from '../application/queries/handlers/list-program-content.handlers';
import { GetApplicationFormFieldsHandler } from '../application/queries/handlers/get-application-form-fields.handler';

import {
  CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
  CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
  CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler,
  CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
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
            ListProgramPricingTiersHandler, ListProgramRequirementsHandler,
            ListProgramEssaysHandler, ListProgramParticipationCategoriesHandler,
            GetApplicationFormFieldsHandler,
            
            CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
            CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
            CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler,
            CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
            
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
            providers: createMockProviders(),
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
