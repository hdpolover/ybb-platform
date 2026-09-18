// services/api/src/modules/applications/application/commands/handlers/review-document.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewDocumentHandler } from './review-document.handler';
import { ReviewDocumentCommand } from '../review-document.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { createCacheServiceMock } from '@test/utils/cache-service-mock';

describe('ReviewDocumentHandler', () => {
  let handler: ReviewDocumentHandler;

  const document = {
    id: 'doc-1',
    name: 'Agreement Letter',
    submissionStatus: 'uploaded',
    application: {
      id: 'app-1',
      programId: 'program-1',
      program: { name: 'Test Program' },
      participant: {
        fullName: 'Jane Participant',
        userId: 'user-1',
        user: { email: 'jane@example.com' },
      },
    },
  };

  const mockPrisma = {
    participantDocument: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockCacheService = createCacheServiceMock();
  const mockRabbitmqProducer = { emit: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.participantDocument.findFirst.mockResolvedValue(document);
    mockPrisma.participantDocument.updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewDocumentHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCacheService },
        { provide: RabbitMQProducerService, useValue: mockRabbitmqProducer },
      ],
    }).compile();

    handler = module.get(ReviewDocumentHandler);
  });

  const command = (action: 'approve' | 'reject' | 'request_revision', note?: string) =>
    new ReviewDocumentCommand('app-1', 'doc-1', 'admin-1', action, note);

  it('approves an uploaded document without requiring a note', async () => {
    const result = await handler.execute(command('approve'));

    expect(result.submissionStatus).toBe('approved');
    expect(mockPrisma.participantDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc-1', submissionStatus: 'uploaded' },
      data: expect.objectContaining({
        submissionStatus: 'approved',
        submissionNote: null,
        reviewedBy: 'admin-1',
      }),
    });
  });

  it('rejects with a note and stores it verbatim', async () => {
    const result = await handler.execute(command('reject', 'Signature missing'));

    expect(result.submissionStatus).toBe('rejected');
    expect(result.submissionNote).toBe('Signature missing');
  });

  it('requests revision with a note', async () => {
    const result = await handler.execute(command('request_revision', 'Wrong page signed'));

    expect(result.submissionStatus).toBe('revision_requested');
    expect(result.submissionNote).toBe('Wrong page signed');
  });

  it('throws BadRequestException when reject has no note', async () => {
    await expect(handler.execute(command('reject'))).rejects.toThrow(BadRequestException);
    expect(mockPrisma.participantDocument.updateMany).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when request_revision has a blank note', async () => {
    await expect(handler.execute(command('request_revision', '   '))).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the document does not belong to the application', async () => {
    mockPrisma.participantDocument.findFirst.mockResolvedValue(null);

    await expect(handler.execute(command('approve'))).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when the document is not in a reviewable state', async () => {
    mockPrisma.participantDocument.findFirst.mockResolvedValue({
      ...document,
      submissionStatus: 'approved',
    });

    await expect(handler.execute(command('approve'))).rejects.toThrow(ConflictException);
    expect(mockPrisma.participantDocument.updateMany).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a racing admin already reviewed it (updateMany matched 0 rows)', async () => {
    mockPrisma.participantDocument.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute(command('approve'))).rejects.toThrow(ConflictException);
  });

  it('invalidates the participant portal cache by userId', async () => {
    await handler.execute(command('approve'));

    expect(mockCacheService.invalidatePortalCache).toHaveBeenCalledWith('user-1');
  });

  it('emits the outcome notification event with participant/program/document context', async () => {
    await handler.execute(command('reject', 'Missing signature'));

    expect(mockRabbitmqProducer.emit).toHaveBeenCalledWith(
      'notification.document_rejected',
      expect.objectContaining({
        participant_name: 'Jane Participant',
        email: 'jane@example.com',
        program_name: 'Test Program',
        document_name: 'Agreement Letter',
        outcome: 'rejected',
        note: 'Missing signature',
      }),
    );
  });

  it('does not fail the review when notification emit throws', async () => {
    mockRabbitmqProducer.emit.mockRejectedValueOnce(new Error('broker down'));

    await expect(handler.execute(command('approve'))).resolves.toMatchObject({
      submissionStatus: 'approved',
    });
  });
});
