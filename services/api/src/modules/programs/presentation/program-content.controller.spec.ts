import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ProgramContentController } from './program-content.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';

import {
  ListProgramGalleryHandler,
  ListProgramTestimonialsHandler,
  ListProgramFaqsHandler,
  ListProgramResourcesHandler,
  ListDocumentTemplatesHandler,
} from '../application/queries/handlers/list-program-content.handlers';

import {
  CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
  CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
  CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
  CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
  CreateDocumentTemplateHandler, UpdateDocumentTemplateHandler, DeleteDocumentTemplateHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

import {
  CreateLoaBatchHandler,
  UpdateLoaBatchHandler,
  ReleaseLoaBatchHandler,
  UnreleaseLoaBatchHandler,
  DeleteLoaBatchHandler,
} from '../application/handlers/loa-batch.handlers';

import {
  GetLoaBatchesHandler,
  GetLoaDownloadsHandler,
} from '../application/handlers/loa-batch.handlers';
import { PreviewLoaTemplateHandler } from '../application/handlers/loa-preview.handler';

import { ListProgramGalleryQuery } from '../application/queries/list-program-content.queries';
import { CreateProgramGalleryCommand } from '../application/commands/program-content.commands';
import {
  CreateLoaBatchCommand,
  UpdateLoaBatchCommand,
  ReleaseLoaBatchCommand,
  UnreleaseLoaBatchCommand,
  DeleteLoaBatchCommand,
} from '../application/commands/loa-batch.commands';
import { GetLoaBatchesQuery, GetLoaDownloadsQuery } from '../application/queries/loa-batch.queries';

describe('ProgramContentController', () => {
    let controller: ProgramContentController;

    // Mocks
    const mockExecute = { execute: jest.fn() };

    // Function to create providers list
    const createMockProviders = () => {
        const handlers = [
            ListProgramGalleryHandler, ListProgramTestimonialsHandler, ListProgramFaqsHandler, ListProgramResourcesHandler,
            ListDocumentTemplatesHandler,
            CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
            CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
            CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
            CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
            CreateDocumentTemplateHandler, UpdateDocumentTemplateHandler, DeleteDocumentTemplateHandler,
            CreateLoaBatchHandler,
            UpdateLoaBatchHandler,
            ReleaseLoaBatchHandler,
            UnreleaseLoaBatchHandler,
            DeleteLoaBatchHandler,
            GetLoaBatchesHandler,
            GetLoaDownloadsHandler,
            PreviewLoaTemplateHandler,
        ];

        return handlers.map(handler => ({
            provide: handler,
            useValue: mockExecute
        }));
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProgramContentController],
            providers: [
                ...createMockProviders(),
                Reflector,
            ],
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<ProgramContentController>(ProgramContentController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getGallery', () => {
        it('should execute ListProgramGalleryQuery', async () => {
            const programId = 'prog-1';
            await controller.getGallery(programId);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(ListProgramGalleryQuery));
            const query = mockExecute.execute.mock.calls[0][0];
            expect(query.programId).toBe(programId);
        });
    });

    describe('addGallery', () => {
        it('should execute CreateProgramGalleryCommand', async () => {
            const dto = {
                programId: 'prog-1',
                type: 'IMAGE',
                imageUrl: 'http://example.com/image.jpg'
            };
            const req = { user: { id: 'admin-1' } } as any;
            const file = { originalname: 'image.jpg' } as unknown as Express.Multer.File;

            await controller.addGallery('prog-1', dto, file, req);

            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateProgramGalleryCommand));
            const cmd = mockExecute.execute.mock.calls[0][0];
            expect(cmd.dto).toBe(dto);
            expect(cmd.userId).toBe('admin-1');
            expect(cmd.image).toBe(file);
        });
    });

    // ─── LOA Release Batch Routes ─────────────────────────────────────────────

    describe('getLoaBatches', () => {
        it('dispatches GetLoaBatchesQuery with programId', async () => {
            mockExecute.execute.mockResolvedValue([]);
            await controller.getLoaBatches('prog-1');
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(GetLoaBatchesQuery));
            const q = mockExecute.execute.mock.calls[0][0] as GetLoaBatchesQuery;
            expect(q.programId).toBe('prog-1');
        });
    });

    describe('createLoaBatch', () => {
        it('dispatches CreateLoaBatchCommand with mapped args and admin user id from req.user.id', async () => {
            mockExecute.execute.mockResolvedValue({ id: 'b1' });
            const dto = { name: 'Wave 1', submissionFrom: '2026-01-01', submissionTo: '2026-03-31' };
            const req = { user: { id: 'admin-1' } } as any;
            await controller.createLoaBatch('prog-1', dto as any, req);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(CreateLoaBatchCommand));
            const cmd = mockExecute.execute.mock.calls[0][0] as CreateLoaBatchCommand;
            expect(cmd.programId).toBe('prog-1');
            expect(cmd.name).toBe('Wave 1');
            expect(cmd.submissionFrom).toEqual(new Date('2026-01-01'));
            expect(cmd.submissionTo).toEqual(new Date('2026-03-31'));
            expect(cmd.adminUserId).toBe('admin-1');
        });
    });

    describe('updateLoaBatch', () => {
        it('dispatches UpdateLoaBatchCommand with parsed dates', async () => {
            mockExecute.execute.mockResolvedValue({ id: 'b1' });
            const dto = { name: 'Wave 1 Updated', submissionFrom: '2026-02-01', submissionTo: '2026-04-30' };
            await controller.updateLoaBatch('prog-1', 'b1', dto as any);
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(UpdateLoaBatchCommand));
            const cmd = mockExecute.execute.mock.calls[0][0] as UpdateLoaBatchCommand;
            expect(cmd.batchId).toBe('b1');
            expect(cmd.programId).toBe('prog-1');
            expect(cmd.name).toBe('Wave 1 Updated');
            expect(cmd.submissionFrom).toEqual(new Date('2026-02-01'));
            expect(cmd.submissionTo).toEqual(new Date('2026-04-30'));
        });

        it('dispatches UpdateLoaBatchCommand with undefined dates when not provided', async () => {
            mockExecute.execute.mockResolvedValue({ id: 'b1' });
            const dto = { name: 'Renamed' };
            await controller.updateLoaBatch('prog-1', 'b1', dto as any);
            const cmd = mockExecute.execute.mock.calls[0][0] as UpdateLoaBatchCommand;
            expect(cmd.submissionFrom).toBeUndefined();
            expect(cmd.submissionTo).toBeUndefined();
        });
    });

    describe('releaseLoaBatch', () => {
        it('dispatches ReleaseLoaBatchCommand with batchId and programId', async () => {
            mockExecute.execute.mockResolvedValue({ id: 'b1', releasedAt: new Date() });
            await controller.releaseLoaBatch('prog-1', 'b1');
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(ReleaseLoaBatchCommand));
            const cmd = mockExecute.execute.mock.calls[0][0] as ReleaseLoaBatchCommand;
            expect(cmd.batchId).toBe('b1');
            expect(cmd.programId).toBe('prog-1');
        });
    });

    describe('unreleaseLoaBatch', () => {
        it('dispatches UnreleaseLoaBatchCommand with batchId and programId', async () => {
            mockExecute.execute.mockResolvedValue({ id: 'b1', releasedAt: null });
            await controller.unreleaseLoaBatch('prog-1', 'b1');
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(UnreleaseLoaBatchCommand));
            const cmd = mockExecute.execute.mock.calls[0][0] as UnreleaseLoaBatchCommand;
            expect(cmd.batchId).toBe('b1');
            expect(cmd.programId).toBe('prog-1');
        });
    });

    describe('deleteLoaBatch', () => {
        it('dispatches DeleteLoaBatchCommand with batchId and programId', async () => {
            mockExecute.execute.mockResolvedValue(undefined);
            await controller.deleteLoaBatch('prog-1', 'b1');
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(DeleteLoaBatchCommand));
            const cmd = mockExecute.execute.mock.calls[0][0] as DeleteLoaBatchCommand;
            expect(cmd.batchId).toBe('b1');
            expect(cmd.programId).toBe('prog-1');
        });
    });

    describe('getLoaDownloads', () => {
        it('dispatches GetLoaDownloadsQuery with programId', async () => {
            mockExecute.execute.mockResolvedValue([]);
            await controller.getLoaDownloads('prog-1');
            expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(GetLoaDownloadsQuery));
            const q = mockExecute.execute.mock.calls[0][0] as GetLoaDownloadsQuery;
            expect(q.programId).toBe('prog-1');
        });
    });
});
