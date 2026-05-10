import { Test, TestingModule } from '@nestjs/testing';
import { ProgramContentController } from './program-content.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';

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
  GenerateLOAHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

import { ListProgramGalleryQuery } from '../application/queries/list-program-content.queries';
import { CreateProgramGalleryCommand } from '../application/commands/program-content.commands';

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
            GenerateLOAHandler,
        ];

        return handlers.map(handler => ({
            provide: handler,
            useValue: mockExecute
        }));
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProgramContentController],
            providers: createMockProviders(),
        })
        .overrideGuard(JwtAuthGuard)
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
});
