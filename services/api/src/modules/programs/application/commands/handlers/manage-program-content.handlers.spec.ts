
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler } from './manage-program-content.handlers';
import { CreateProgramSpeakerCommand, UpdateProgramSpeakerCommand } from '../program-content.commands';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('ManageProgramContentHandlers', () => {
    
    // --- MOCKS ---
    let repository: any;
    let storageService: any;
    let prismaService: any;

    const mockRepository = {
        createSpeaker: jest.fn(),
        findSpeakerById: jest.fn(),
        updateSpeaker: jest.fn(),
    };

    const mockStorageService = {
        uploadFile: jest.fn(),
    };

    const mockPrismaService = {
        program: {
            findUnique: jest.fn(),
        },
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
            const file = { originalname: 'photo.jpg' };
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
            const command = new CreateProgramSpeakerCommand(dto, 'user-1', {});

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
            const file = { originalname: 'new.jpg' };
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
});
