import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ProgramsController } from './programs.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

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

    // Admin scope lookup used by AdminScopeGuard / assertBrandAccess. Defaults to a
    // platform-scope (super) admin so the pre-existing tests behave exactly as before.
    const PLATFORM_ADMIN = {
        accessLevel: 10,
        canManageAdmins: true,
        canAssignRoles: true,
        customPermissions: [],
        role: { name: 'super admin', permissions: ['*'] },
        adminBrands: [],
        adminPrograms: [],
    };
    const mockReadPrisma = {
        admin: { findUnique: jest.fn() },
        program: { findUnique: jest.fn() },
    };

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
            { provide: PrismaReadService, useValue: mockReadPrisma },
        ];
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProgramsController],
            providers: createMockProviders(),
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(AdminScopeGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<ProgramsController>(ProgramsController);
        jest.clearAllMocks();
        mockReadPrisma.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
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
            const req = { user: { id: 'admin-1', adminId: 'admin-1' } } as any;
            
            mockExecute.execute.mockResolvedValue({ id: 'prog-1', ...dto });

            await controller.create(dto, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateProgramCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.createProgramDto).toBe(dto);
            expect(cmd.userId).toBe('admin-1');
        });

        it('rejects creating a program under a brand the admin is not assigned to', async () => {
            mockReadPrisma.admin.findUnique.mockResolvedValue({
                accessLevel: 1,
                canManageAdmins: false,
                canAssignRoles: false,
                customPermissions: [],
                role: { name: 'admin', permissions: [] },
                adminBrands: [{ brandId: 'brand-mine', permissions: [] }],
                adminPrograms: [],
            });

            const dto: any = {
                name: 'New Program',
                brandId: 'brand-someone-else',
                slug: 'new-program',
                year: 2024,
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                applicationDeadline: new Date().toISOString(),
            };
            const req = { user: { id: 'admin-1', adminId: 'admin-1' } } as any;

            await expect(controller.create(dto, req)).rejects.toThrow(ForbiddenException);
            expect(mockExecute.execute).not.toHaveBeenCalled();
        });
    });
});
