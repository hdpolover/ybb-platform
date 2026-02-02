import { Test, TestingModule } from '@nestjs/testing';
import { ProgramScheduleController } from './program-schedule.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';

import {
  ListProgramTimelineHandler,
  ListProgramSchedulesHandler,
} from '../application/queries/handlers/list-program-content.handlers';

import {
  CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
  CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

import { ListProgramTimelineQuery } from '../application/queries/list-program-content.queries';
import { CreateProgramTimelineCommand } from '../application/commands/program-content.commands';

describe('ProgramScheduleController', () => {
    let controller: ProgramScheduleController;
    
    // Mocks
    const mockExecute = { execute: jest.fn() };

    // Function to create providers list
    const createMockProviders = () => {
        const handlers = [
            ListProgramTimelineHandler, ListProgramSchedulesHandler,
            CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
            CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler
        ];

        return handlers.map(handler => ({
            provide: handler,
            useValue: mockExecute
        }));
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProgramScheduleController],
            providers: createMockProviders(),
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<ProgramScheduleController>(ProgramScheduleController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getTimeline', () => {
        it('should execute ListProgramTimelineQuery', async () => {
            const programId = 'prog-1';
            await controller.getTimeline(programId);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(ListProgramTimelineQuery));
            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.programId).toBe(programId);
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
});
