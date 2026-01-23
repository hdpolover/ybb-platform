
import { Test, TestingModule } from '@nestjs/testing';
import { ProgramsController } from './programs.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';

// Main Handlers
import { ListProgramsHandler } from '../application/queries/handlers/list-programs.handler';
import { GetProgramDetailHandler } from '../application/queries/handlers/get-program-detail.handler';
import { CreateProgramHandler } from '../application/commands/handlers/create-program.handler';
import { UpdateProgramHandler } from '../application/commands/handlers/update-program.handler';
import { UpdateProgramBrandingHandler } from '../application/commands/handlers/update-program-branding.handler';
import { DeleteProgramHandler } from '../application/commands/handlers/delete-program.handler';
import { GetParticipantProgressHandler } from '../application/queries/handlers/get-participant-progress.handler';

// List Handlers
import {
    ListProgramTimelineHandler, ListProgramSchedulesHandler, ListProgramSpeakersHandler,
    ListProgramGalleryHandler, ListProgramTestimonialsHandler, ListProgramFaqsHandler,
    ListProgramTeamHandler, ListProgramPartnersHandler, ListProgramResourcesHandler,
    ListProgramPricingTiersHandler, ListProgramRequirementsHandler
} from '../application/queries/handlers/list-program-content.handlers';

// CUD Handlers (Content)
import {
    CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
    CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler,
    CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
    CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
    CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
    CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
    CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
    CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler,
    CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
    CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
    CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

// Form Fields
import {
    CreateApplicationFormFieldHandler, UpdateApplicationFormFieldHandler, DeleteApplicationFormFieldHandler
} from '../application/commands/handlers/application-form-field.handler';
import { GetApplicationFormFieldsHandler } from '../application/queries/handlers/get-application-form-fields.handler';

import { ListProgramsQuery } from '../application/queries/list-programs.query';
import { CreateProgramCommand } from '../application/commands/create-program.command';

import {
  CreateProgramTimelineCommand,
  UpdateProgramSpeakerCommand
} from '../application/commands/program-content.commands';

describe('ProgramsController', () => {
    let controller: ProgramsController;
    
    // Mocks
    const mockExecute = { execute: jest.fn() };

    // Function to create providers list to save space
    const createMockProviders = () => {
        const handlers = [
            ListProgramsHandler, GetProgramDetailHandler, CreateProgramHandler, UpdateProgramHandler,
            UpdateProgramBrandingHandler, DeleteProgramHandler, GetParticipantProgressHandler,
            
            ListProgramTimelineHandler, ListProgramSchedulesHandler, ListProgramSpeakersHandler,
            ListProgramGalleryHandler, ListProgramTestimonialsHandler, ListProgramFaqsHandler,
            ListProgramTeamHandler, ListProgramPartnersHandler, ListProgramResourcesHandler,
            ListProgramPricingTiersHandler, ListProgramRequirementsHandler,

            CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
            CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler,
            CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
            CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
            CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
            CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
            CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
            CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler,
            CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
            CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
            CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,

            CreateApplicationFormFieldHandler, UpdateApplicationFormFieldHandler, DeleteApplicationFormFieldHandler,
            GetApplicationFormFieldsHandler
        ];

        return handlers.map(handler => ({
            provide: handler,
            useValue: mockExecute
        }));
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProgramsController],
            providers: createMockProviders(),
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<ProgramsController>(ProgramsController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should execute ListProgramsQuery', async () => {
            const dto = { programCategoryId: 'cat-1', year: 2024, isPublished: true, page: 1, limit: 10 };
            await controller.findAll(dto);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(ListProgramsQuery));
            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.programCategoryId).toBe('cat-1');
            expect(query.year).toBe(2024);
        });
    });

    describe('create', () => {
        it('should execute CreateProgramCommand', async () => {
            const dto = { 
                name: 'New Program', 
                programCategoryId: 'cat-1',
                slug: "new-program",
                year: 2024,
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                applicationDeadline: new Date().toISOString()
             };
            const req = { user: { id: 'admin-1' } };
            
            mockExecute.execute.mockResolvedValue({ id: 'prog-1', ...dto });

            await controller.create(dto, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateProgramCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.createProgramDto).toBe(dto);
            expect(cmd.userId).toBe('admin-1');
        });
    });

    describe('addTimeline', () => {
        it('should execute CreateProgramTimelineCommand', async () => {
            const dto = { 
                programId: 'prog-1',
                title: 'Welcome',
                description: 'Day 1',
                date: new Date().toISOString()
            };
            const req = { user: { id: 'admin-1' } };

            await controller.addTimeline('prog-1', dto, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateProgramTimelineCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.dto).toBe(dto);
            expect(cmd.userId).toBe('admin-1');
        });
    });

    describe('updateSpeaker', () => {
        it('should execute UpdateProgramSpeakerCommand with file', async () => {
            const dto = { name: 'John Doe' };
            const req = { user: { id: 'admin-1' } };
            const file = { originalname: 'photo.jpg' };

            await controller.updateSpeaker('item-1', dto, file, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(UpdateProgramSpeakerCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.id).toBe('item-1');
            expect(cmd.dto).toBe(dto);
            expect(cmd.image).toBe(file);
        });
    });
});
