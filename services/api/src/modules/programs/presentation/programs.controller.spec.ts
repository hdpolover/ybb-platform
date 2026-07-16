import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
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

import { ListProgramsQuery } from '../application/queries/list-programs.query';
import { CreateProgramCommand } from '../application/commands/create-program.command';

describe('ProgramsController', () => {
    let controller: ProgramsController;
    
    // Mocks
    const mockExecute = { execute: jest.fn() };

    // Function to create providers list to save space
    const createMockProviders = () => {
        const handlers = [
            ListProgramsHandler, GetProgramDetailHandler, CreateProgramHandler, UpdateProgramHandler,
            UpdateProgramBrandingHandler, DeleteProgramHandler, GetParticipantProgressHandler
        ];

        const handlerProviders = handlers.map(handler => ({
            provide: handler,
            useValue: mockExecute
        }));

        return [
            ...handlerProviders,
            { provide: CommandBus, useValue: mockExecute },
        ];
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
            const dto = { brandId: 'cat-1', year: 2024, isPublished: true, page: 1, limit: 10 };
            await controller.findAll(dto);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(ListProgramsQuery));
            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.brandId).toBe('cat-1');
            expect(query.year).toBe(2024);
        });
    });

    describe('create', () => {
        it('should execute CreateProgramCommand', async () => {
            const dto = { 
                name: 'New Program', 
                brandId: 'cat-1',
                slug: "new-program",
                year: 2024,
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                applicationDeadline: new Date().toISOString()
             };
            const req = { user: { id: 'admin-1' } } as any;
            
            mockExecute.execute.mockResolvedValue({ id: 'prog-1', ...dto });

            await controller.create(dto, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateProgramCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.createProgramDto).toBe(dto);
            expect(cmd.userId).toBe('admin-1');
        });
    });
});
