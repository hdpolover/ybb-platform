import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ProgramsController } from './programs.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../modules/auth/infrastructure/guards/optional-jwt-auth.guard';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { UserRole } from '@core/entities/user.entity';

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
        .overrideGuard(OptionalJwtAuthGuard)
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

        // Audit M13: findAll runs behind OptionalJwtAuthGuard now, so an anonymous
        // caller reaches this method with no CurrentUser at all — the query must
        // come out with isAdmin falsy, which is what makes the repository force
        // public-safe filters (see program.repository.spec.ts for that half).
        it('sets query.isAdmin to false when no user is resolved (anonymous caller, e.g. ?isPublished=false)', async () => {
            const dto = { isPublished: false };

            await controller.findAll(dto, undefined);

            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.isAdmin).toBe(false);
            // The dto's isPublished still rides along on the query — it's the
            // repository's job to ignore it for a non-admin, not the controller's.
            expect(query.isPublished).toBe(false);
        });

        it('sets query.isAdmin to false for an authenticated caller without an admin role', async () => {
            const dto = {};
            const participantUser = { userId: 'u-1', email: 'p@example.com', brandId: 'b-1', role: [UserRole.PARTICIPANT] } as any;

            await controller.findAll(dto, participantUser);

            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.isAdmin).toBe(false);
        });

        it('sets query.isAdmin to true for an ADMIN-role caller, preserving admin dashboard behavior', async () => {
            const dto = { isPublished: false, status: 'draft' };
            const adminUser = { userId: 'u-2', email: 'a@example.com', brandId: 'b-1', role: [UserRole.ADMIN] } as any;

            await controller.findAll(dto, adminUser);

            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.isAdmin).toBe(true);
        });

        it('sets query.isAdmin to true for a SUPER_ADMIN-role caller', async () => {
            const dto = {};
            const superAdminUser = { userId: 'u-3', email: 's@example.com', brandId: 'b-1', role: UserRole.SUPER_ADMIN } as any;

            await controller.findAll(dto, superAdminUser);

            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.isAdmin).toBe(true);
        });
    });

    describe('findOne', () => {
        // Audit M13: findOne also runs behind OptionalJwtAuthGuard, and wires the
        // resolved caller into GetProgramDetailQuery.isAdmin the same way findAll
        // does — see get-program-detail.handler.spec.ts for the 404/resources
        // filtering that isAdmin drives downstream.
        it('sets query.isAdmin to false for an anonymous caller', async () => {
            await controller.findOne('some-slug', undefined);

            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.isAdmin).toBe(false);
        });

        it('sets query.isAdmin to true for an ADMIN-role caller', async () => {
            const adminUser = { userId: 'u-2', email: 'a@example.com', brandId: 'b-1', role: [UserRole.ADMIN] } as any;

            await controller.findOne('some-slug', adminUser);

            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.isAdmin).toBe(true);
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
