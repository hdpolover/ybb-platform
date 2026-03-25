import { Test, TestingModule } from '@nestjs/testing';
import { ProgramPeopleController } from './program-people.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';

import {
  ListProgramSpeakersHandler,
  ListProgramTeamHandler,
  ListProgramPartnersHandler,
} from '../application/queries/handlers/list-program-content.handlers';

import {
  CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
  CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
  CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

import { ListProgramSpeakersQuery } from '../application/queries/list-program-content.queries';
import { CreateProgramSpeakerCommand } from '../application/commands/program-content.commands';

describe('ProgramPeopleController', () => {
    let controller: ProgramPeopleController;
    
    // Mocks
    const mockExecute = { execute: jest.fn() };

    // Function to create providers list
    const createMockProviders = () => {
        const handlers = [
            ListProgramSpeakersHandler, ListProgramTeamHandler, ListProgramPartnersHandler,
            CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
            CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
            CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler
        ];

        return handlers.map(handler => ({
            provide: handler,
            useValue: mockExecute
        }));
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProgramPeopleController],
            providers: createMockProviders(),
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<ProgramPeopleController>(ProgramPeopleController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getSpeakers', () => {
        it('should execute ListProgramSpeakersQuery', async () => {
            const programId = 'prog-1';
            await controller.getSpeakers(programId);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(ListProgramSpeakersQuery));
            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.programId).toBe(programId);
        });
    });

    describe('addSpeaker', () => {
        it('should execute CreateProgramSpeakerCommand', async () => {
            const dto = { 
                programId: 'prog-1',
                name: 'Speaker Name',
                title: 'CEO',
                bio: 'Bio here'
            };
            const req = { user: { id: 'admin-1' } } as any;
            const file = { originalname: 'photo.jpg' } as unknown as Express.Multer.File;
            
            await controller.addSpeaker('prog-1', dto, file, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateProgramSpeakerCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.dto).toBe(dto);
            expect(cmd.userId).toBe('admin-1');
            expect(cmd.image).toBe(file);
        });
    });
});
