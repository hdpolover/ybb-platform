
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    CreateProgramEssayHandler,
    CreateProgramSpeakerHandler,
    DeleteProgramEssayHandler,
    GenerateLOAHandler,
    UpdateProgramEssayHandler,
    UpdateProgramSpeakerHandler,
} from './manage-program-content.handlers';
import {
    CreateProgramEssayCommand,
    CreateProgramSpeakerCommand,
    DeleteProgramEssayCommand,
    GenerateLOACommand,
    LoaAudience,
    UpdateProgramEssayCommand,
    UpdateProgramSpeakerCommand,
} from '../program-content.commands';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { FileServiceClient } from '../../../../files/infrastructure/clients/file-service.client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

describe('ManageProgramContentHandlers', () => {
    
    // --- MOCKS ---
    let repository: any;
    let storageService: any;
    let prismaService: any;

    const mockRepository = {
        createSpeaker: jest.fn(),
        findSpeakerById: jest.fn(),
        updateSpeaker: jest.fn(),
        createEssay: jest.fn(),
        findEssayById: jest.fn(),
        updateEssay: jest.fn(),
        deleteEssay: jest.fn(),
    };

    const mockStorageService = {
        uploadFile: jest.fn(),
    };

    const mockPrismaService = {
        program: {
            findUnique: jest.fn(),
        },
    };

    const mockCacheService = {
        invalidateByPatterns: jest.fn(),
    };

    beforeEach(async () => {
         // Reset mocks
         jest.clearAllMocks();
    });

    describe('CreateProgramSpeakerHandler', () => {
        let handler: CreateProgramSpeakerHandler;

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CreateProgramSpeakerHandler,
                    { provide: 'IProgramContentRepository', useValue: mockRepository },
                    { provide: StorageService, useValue: mockStorageService },
                    { provide: PrismaService, useValue: mockPrismaService },
                ],
            }).compile();
            handler = module.get<CreateProgramSpeakerHandler>(CreateProgramSpeakerHandler);
        });

        it('should create speaker with uploaded photo', async () => {
            const dto = { programId: 'prog-1', name: 'Speaker 1' };
            const file = { originalname: 'photo.jpg' } as unknown as Express.Multer.File;
            const command = new CreateProgramSpeakerCommand(dto, 'user-1', file);

            // Mock Program existence for Brand ID lookup
            mockPrismaService.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-1' });
            
            // Mock Upload
            mockStorageService.uploadFile.mockResolvedValue({ url: 'http://cdn/photo.jpg' });

            // Mock Create
            mockRepository.createSpeaker.mockResolvedValue({ id: 'spk-1', ...dto, photoUrl: 'http://cdn/photo.jpg' });

            const result = await handler.execute(command);

            expect(mockPrismaService.program.findUnique).toHaveBeenCalledWith({ where: { id: 'prog-1' } });
            expect(mockStorageService.uploadFile).toHaveBeenCalledWith(file, 'user-1', 'brand-1', 'speakers', 'prog-1');
            expect(mockRepository.createSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                photoUrl: 'http://cdn/photo.jpg'
            }));
            expect(result.id).toBe('spk-1');
        });

        it('should throw NotFoundException if program not found during upload', async () => {
            const dto = { programId: 'prog-1', name: 'Speaker' };
            const command = new CreateProgramSpeakerCommand(dto, 'user-1', {} as unknown as Express.Multer.File);

            mockPrismaService.program.findUnique.mockResolvedValue(null);

            await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
            expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
        });
    });

    describe('UpdateProgramSpeakerHandler', () => {
        let handler: UpdateProgramSpeakerHandler;

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    UpdateProgramSpeakerHandler,
                    { provide: 'IProgramContentRepository', useValue: mockRepository },
                    { provide: StorageService, useValue: mockStorageService },
                    { provide: PrismaService, useValue: mockPrismaService },
                ],
            }).compile();
            handler = module.get<UpdateProgramSpeakerHandler>(UpdateProgramSpeakerHandler);
        });

        it('should update speaker photo if new file provided', async () => {
            const dto = { name: 'Updated Name' };
            const file = { originalname: 'new.jpg' } as unknown as Express.Multer.File;
            const command = new UpdateProgramSpeakerCommand('spk-1', dto, 'user-1', file);

            // Mock Speaker Lookup
            mockRepository.findSpeakerById.mockResolvedValue({ id: 'spk-1', programId: 'prog-1' });

            // Mock Program Lookup
            mockPrismaService.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-1' });

            // Mock Upload
            mockStorageService.uploadFile.mockResolvedValue({ url: 'http://cdn/new.jpg' });

            // Mock Update
            mockRepository.updateSpeaker.mockResolvedValue({ id: 'spk-1', name: 'Updated Name', photoUrl: 'http://cdn/new.jpg' });

            await handler.execute(command);

            expect(mockRepository.findSpeakerById).toHaveBeenCalledWith('spk-1');
            expect(mockStorageService.uploadFile).toHaveBeenCalledWith(file, 'user-1', 'brand-1', 'speakers', 'prog-1');
            expect(mockRepository.updateSpeaker).toHaveBeenCalledWith('spk-1', expect.objectContaining({
                photoUrl: 'http://cdn/new.jpg'
            }));
        });
    });

    describe('Essay cache invalidation', () => {
        beforeEach(() => {
            mockCacheService.invalidateByPatterns.mockResolvedValue(undefined);
        });

        it('invalidates portal essay caches after creating an essay', async () => {
            const handler = new CreateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new CreateProgramEssayCommand(
                {
                    programId: 'program-1',
                    question: 'Why should we pick you?',
                },
                'user-1',
            );

            mockRepository.createEssay.mockResolvedValue({ id: 'essay-1', ...command.dto });

            await handler.execute(command);

            expect(mockRepository.createEssay).toHaveBeenCalledWith(command.dto);
            expect(mockCacheService.invalidateByPatterns).toHaveBeenCalledWith([
                'program:essays:program-1',
                'portal:submission-detail:*:program-1',
                'portal:submission-detail:*:latest',
                'portal:submissions:*:program-1',
                'portal:submissions:*:latest',
                'portal:dashboard:*',
            ]);
        });

        it('rejects creating essay with placeholder question', async () => {
            const handler = new CreateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new CreateProgramEssayCommand(
                {
                    programId: 'program-1',
                    question: '-',
                },
                'user-1',
            );

            await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
            expect(mockRepository.createEssay).not.toHaveBeenCalled();
        });

        it('invalidates portal essay caches after updating an essay', async () => {
            const handler = new UpdateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new UpdateProgramEssayCommand(
                'essay-1',
                { question: 'Updated question' },
                'user-1',
            );

            mockRepository.findEssayById.mockResolvedValue({ id: 'essay-1', programId: 'program-1' });
            mockRepository.updateEssay.mockResolvedValue({
                id: 'essay-1',
                programId: 'program-1',
                question: 'Updated question',
            });

            await handler.execute(command);

            expect(mockRepository.findEssayById).toHaveBeenCalledWith('essay-1');
            expect(mockRepository.updateEssay).toHaveBeenCalledWith('essay-1', command.dto);
            expect(mockCacheService.invalidateByPatterns).toHaveBeenCalledWith([
                'program:essays:program-1',
                'portal:submission-detail:*:program-1',
                'portal:submission-detail:*:latest',
                'portal:submissions:*:program-1',
                'portal:submissions:*:latest',
                'portal:dashboard:*',
            ]);
        });

        it('rejects updating essay with placeholder question', async () => {
            const handler = new UpdateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new UpdateProgramEssayCommand(
                'essay-1',
                { question: '  n/a  ' },
                'user-1',
            );

            mockRepository.findEssayById.mockResolvedValue({ id: 'essay-1', programId: 'program-1' });

            await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
            expect(mockRepository.updateEssay).not.toHaveBeenCalled();
        });

        it('invalidates portal essay caches after deleting an essay', async () => {
            const handler = new DeleteProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new DeleteProgramEssayCommand('essay-1', 'user-1');

            mockRepository.findEssayById.mockResolvedValue({ id: 'essay-1', programId: 'program-1' });
            mockRepository.deleteEssay.mockResolvedValue(undefined);

            await handler.execute(command);

            expect(mockRepository.findEssayById).toHaveBeenCalledWith('essay-1');
            expect(mockRepository.deleteEssay).toHaveBeenCalledWith('essay-1');
            expect(mockCacheService.invalidateByPatterns).toHaveBeenCalledWith([
                'program:essays:program-1',
                'portal:submission-detail:*:program-1',
                'portal:submission-detail:*:latest',
                'portal:submissions:*:program-1',
                'portal:submissions:*:latest',
                'portal:dashboard:*',
            ]);
        });
    });
});

describe('GenerateLOAHandler', () => {
  const makePrisma = () => ({
    documentTemplate: { findFirst: jest.fn() },
    program: { findUnique: jest.fn() },
    participantApplication: { findMany: jest.fn().mockResolvedValue([]) },
    participantDocument: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  });

  it('filters by submitted when audience=submitted', async () => {
    const prisma = makePrisma() as unknown as PrismaService;
    (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tmpl-1', type: 'letter_of_acceptance', htmlContent: '<p>Hi</p>', layoutConfig: {}, placeholders: [],
    });
    (prisma.program.findUnique as jest.Mock).mockResolvedValue({
      id: 'prog-1', name: 'YBB 2026', year: 2026, brandId: 'brand-1',
      brand: { landingUrl: 'https://portal.ybb.io', websiteUrl: null },
    });

    const handler = new GenerateLOAHandler(
      prisma,
      {} as StorageService,
      {} as FileServiceClient,
      {} as CacheService,
      { emit: jest.fn().mockResolvedValue(true) } as unknown as RabbitMQProducerService,
    );

    const cmd = new GenerateLOACommand('prog-1', 'tmpl-1', 'user-1', undefined, true, 'submitted');
    await handler.execute(cmd);

    const callArgs = (prisma.participantApplication.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.status).toBe('submitted');
  });

  it('defaults to accepted when bulk=true and no audience', async () => {
    const prisma = makePrisma() as unknown as PrismaService;
    (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tmpl-1', type: 'letter_of_acceptance', htmlContent: '<p>Hi</p>', layoutConfig: {}, placeholders: [],
    });
    (prisma.program.findUnique as jest.Mock).mockResolvedValue({
      id: 'prog-1', name: 'YBB 2026', year: 2026, brandId: 'brand-1',
      brand: { landingUrl: 'https://portal.ybb.io', websiteUrl: null },
    });

    const handler = new GenerateLOAHandler(
      prisma,
      {} as StorageService,
      {} as FileServiceClient,
      {} as CacheService,
      { emit: jest.fn().mockResolvedValue(true) } as unknown as RabbitMQProducerService,
    );

    const cmd = new GenerateLOACommand('prog-1', 'tmpl-1', 'user-1', undefined, true);
    await handler.execute(cmd);

    const callArgs = (prisma.participantApplication.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.status).toBe('accepted');
  });
});
