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

    it('normalizes phone country code fields to dial code format', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
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
            new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                phone_country_code: 'ID',
                emergency_country_code: '+905538803144',
            }),
        );

        expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: {
                personalData: {
                    phone_country_code: '+62',
                    emergency_country_code: '+90',
                },
            },
        });
    });

    describe('save-time phone normalization', () => {
        it('normalizes a valid national-format phone to E.164 using nationality as the region hint', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({
                id: 'app-1',
                status: 'draft',
                personalData: { nationality: 'PK', full_name: 'Existing Name' },
                essayAnswers: {},
                uploadedFiles: {},
            });

            mockPrisma.participantApplication.update.mockResolvedValue({});

            await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    phone: '03255252525',
                }),
            );

            expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: {
                        nationality: 'PK',
                        full_name: 'Existing Name',
                        phone: '+923255252525',
                    },
                },
            });
        });

        it('stores an invalid/garbage phone exactly as entered, without throwing', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({
                id: 'app-1',
                status: 'draft',
                personalData: {},
                essayAnswers: {},
                uploadedFiles: {},
            });

            mockPrisma.participantApplication.update.mockResolvedValue({});

            const result = await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    phone: 'abc123',
                }),
            );

            expect(result.success).toBe(true);
            expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: { phone: 'abc123' },
                },
            });
        });

        it('preserves unrelated personal_data fields untouched when normalizing the phone', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({
                id: 'app-1',
                status: 'draft',
                personalData: { nationality: 'KZ', country: 'Kazakhstan', institution: 'ABC University' },
                essayAnswers: {},
                uploadedFiles: {},
            });

            mockPrisma.participantApplication.update.mockResolvedValue({});

            await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    phone: '+77012345678',
                    emergency_contact_name: 'Jane Doe',
                }),
            );

            expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: {
                        nationality: 'KZ',
                        country: 'Kazakhstan',
                        institution: 'ABC University',
                        phone: '+77012345678',
                        emergency_contact_name: 'Jane Doe',
                    },
                },
            });
        });

        it('leaves personal_data untouched when the section payload has no phone key', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({
                id: 'app-1',
                status: 'draft',
                personalData: { phone: '+77012345678' },
                essayAnswers: {},
                uploadedFiles: {},
            });

            mockPrisma.participantApplication.update.mockResolvedValue({});

            await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    institution: 'Some University',
                }),
            );

            expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: {
                        phone: '+77012345678',
                        institution: 'Some University',
                    },
                },
            });
        });
    });
});
