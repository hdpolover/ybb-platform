import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListApplicationDocumentsHandler } from './list-application-documents.handler';
import { ListApplicationDocumentsQuery } from '../list-application-documents.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('ListApplicationDocumentsHandler — ownership check', () => {
    let handler: ListApplicationDocumentsHandler;

    const mockRepository = {
        findDocumentsByApplicationId: jest.fn(),
    };

    const mockParticipantRepository = {
        findByUserId: jest.fn(),
    };

    const mockPrisma = {
        participantApplication: {
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListApplicationDocumentsHandler,
                { provide: 'IAchievementsRepository', useValue: mockRepository },
                { provide: 'IParticipantRepository', useValue: mockParticipantRepository },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        handler = module.get<ListApplicationDocumentsHandler>(ListApplicationDocumentsHandler);
        jest.clearAllMocks();
    });

    it('throws NotFoundException when the participant profile is not found', async () => {
        // Arrange
        mockParticipantRepository.findByUserId.mockResolvedValue(null);

        // Act & Assert
        await expect(
            handler.execute(new ListApplicationDocumentsQuery('app-1', 'user-unknown')),
        ).rejects.toThrow(NotFoundException);

        expect(mockPrisma.participantApplication.findUnique).not.toHaveBeenCalled();
        expect(mockRepository.findDocumentsByApplicationId).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the application does not exist', async () => {
        // Arrange
        mockParticipantRepository.findByUserId.mockResolvedValue({ id: 'participant-1' });
        mockPrisma.participantApplication.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
            handler.execute(new ListApplicationDocumentsQuery('app-nonexistent', 'user-1')),
        ).rejects.toThrow(ForbiddenException);

        expect(mockRepository.findDocumentsByApplicationId).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the application belongs to a different user (IDOR attempt)', async () => {
        // Arrange — attacker is user-attacker, application belongs to user-victim
        mockParticipantRepository.findByUserId.mockResolvedValue({ id: 'participant-attacker' });
        mockPrisma.participantApplication.findUnique.mockResolvedValue({
            participant: { userId: 'user-victim' },
        });

        // Act & Assert
        await expect(
            handler.execute(new ListApplicationDocumentsQuery('app-victim', 'user-attacker')),
        ).rejects.toThrow(ForbiddenException);

        expect(mockRepository.findDocumentsByApplicationId).not.toHaveBeenCalled();
    });

    it('returns documents when the caller owns the application', async () => {
        // Arrange
        const userId = 'user-owner';
        const applicationId = 'app-owner';

        mockParticipantRepository.findByUserId.mockResolvedValue({ id: 'participant-owner' });
        mockPrisma.participantApplication.findUnique.mockResolvedValue({
            participant: { userId },
        });
        mockRepository.findDocumentsByApplicationId.mockResolvedValue([
            {
                id: 'doc-1',
                documentNumber: 'DOC-001',
                documentUrl: 'https://cdn.example.com/doc-1.pdf',
                generatedAt: new Date('2025-01-01'),
                templateName: 'Certificate of Participation',
            },
        ]);

        // Act
        const result = await handler.execute(new ListApplicationDocumentsQuery(applicationId, userId));

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('doc-1');
        expect(mockRepository.findDocumentsByApplicationId).toHaveBeenCalledWith(applicationId);
    });
});
