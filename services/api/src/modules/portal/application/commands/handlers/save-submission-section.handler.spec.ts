import { Test, TestingModule } from '@nestjs/testing';
import { SaveSubmissionSectionHandler } from './save-submission-section.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { SaveSubmissionSectionCommand } from '../../queries/portal-queries';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SaveSubmissionSectionHandler', () => {
    let handler: SaveSubmissionSectionHandler;

    const mockPrisma = {
        participantApplication: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
    };

    const mockCacheService = {
        invalidateKey: jest.fn().mockResolvedValue(undefined),
    };

    const mockPortalCacheService = {
        getParticipantProfile: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SaveSubmissionSectionHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
            ],
        }).compile();

        handler = module.get<SaveSubmissionSectionHandler>(SaveSubmissionSectionHandler);
        jest.clearAllMocks();
    });

    it('should save personal_info section data', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            status: 'draft',
            personalData: { country: 'Indonesia' },
            essayAnswers: {},
            uploadedFiles: {},
        });

        mockPrisma.participantApplication.update.mockResolvedValue({});

        const result = await handler.execute(
            new SaveSubmissionSectionCommand('user-1', 'personal_info', {
                full_name: 'John Doe',
                email: 'john@example.com',
            }),
        );

        expect(result.success).toBe(true);
        expect(result.section).toBe('personal_info');

        // Verify merge behavior — existing country should be preserved
        expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: {
                personalData: {
                    country: 'Indonesia',
                    full_name: 'John Doe',
                    email: 'john@example.com',
                },
            },
        });
    });

    it('should save essays section data', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            status: 'draft',
            personalData: {},
            essayAnswers: { 'essay-1': 'Previous answer' },
            uploadedFiles: {},
        });

        mockPrisma.participantApplication.update.mockResolvedValue({});

        const result = await handler.execute(
            new SaveSubmissionSectionCommand('user-1', 'essays', {
                'essay-2': 'New essay answer',
            }),
        );

        expect(result.success).toBe(true);
        expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: {
                essayAnswers: {
                    'essay-1': 'Previous answer',
                    'essay-2': 'New essay answer',
                },
            },
        });
    });

    it('should throw BadRequestException for invalid section', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
        });

        await expect(
            handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'invalid_section', {}),
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-draft application', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            status: 'submitted',
            personalData: {},
            essayAnswers: {},
            uploadedFiles: {},
        });

        await expect(
            handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'personal_info', {}),
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when no participant found', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue(null);

        await expect(
            handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'personal_info', {}),
            ),
        ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate caches after saving', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            status: 'draft',
            personalData: {},
            essayAnswers: {},
            uploadedFiles: {},
        });

        mockPrisma.participantApplication.update.mockResolvedValue({});

        await handler.execute(
            new SaveSubmissionSectionCommand('user-1', 'personal_info', {}),
        );

        expect(mockCacheService.invalidateKey).toHaveBeenCalledTimes(3);
    });
});
