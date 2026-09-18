// services/api/src/modules/portal/application/commands/handlers/upload-signed-copy.handler.spec.ts
//
// Phase 1 of the agreement letter review workflow: re-upload after a review
// outcome. An approved document is locked (no re-upload at all); rejected and
// revision_requested both allow re-upload and reset the row back to
// 'uploaded' for re-review.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadSignedCopyHandler } from './upload-signed-copy.handler';
import { UploadSignedCopyCommand } from '../../queries/portal-queries';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '@modules/files/application/storage.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { createCacheServiceMock } from '@test/utils/cache-service-mock';

describe('UploadSignedCopyHandler', () => {
  let handler: UploadSignedCopyHandler;

  const mockPrisma = {
    participant: { findFirst: jest.fn() },
    documentTemplate: { findFirst: jest.fn() },
    participantApplication: { findFirst: jest.fn() },
    program: { findUnique: jest.fn() },
    participantDocument: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  };

  const mockStorageService = { uploadFile: jest.fn() };
  const mockCacheService = createCacheServiceMock();

  const file = { originalname: 'signed.pdf' } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.participant.findFirst.mockResolvedValue({ id: 'participant-1', userId: 'user-1' });
    mockPrisma.documentTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      type: 'agreement_letter',
      programId: 'program-1',
      name: 'Agreement Letter',
      templateUrl: 'https://example.com/template.pdf',
    });
    mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1' });
    mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1', brandId: 'brand-1' });
    mockStorageService.uploadFile.mockResolvedValue({ url: 'https://example.com/signed.pdf' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadSignedCopyHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    handler = module.get(UploadSignedCopyHandler);
  });

  const command = () => new UploadSignedCopyCommand('template-1', 'user-1', file);

  it('creates a new document with signedCopyUploadedAt set when none exists yet', async () => {
    mockPrisma.participantDocument.findFirst.mockResolvedValue(null);

    await handler.execute(command());

    expect(mockPrisma.participantDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submissionStatus: 'uploaded',
        signedCopyUploadedAt: expect.any(Date),
      }),
    });
    expect(mockStorageService.uploadFile).toHaveBeenCalled();
  });

  it('refuses re-upload when the existing document is approved', async () => {
    mockPrisma.participantDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      submissionStatus: 'approved',
    });

    await expect(handler.execute(command())).rejects.toThrow(BadRequestException);
    expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
    expect(mockPrisma.participantDocument.update).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'revision_requested'])(
    'allows re-upload and resets status to uploaded when the existing document is %s',
    async (priorStatus) => {
      mockPrisma.participantDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        submissionStatus: priorStatus,
      });

      await handler.execute(command());

      expect(mockPrisma.participantDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          submissionStatus: 'uploaded',
          submissionNote: null,
          signedCopyUploadedAt: expect.any(Date),
          reviewedBy: null,
          reviewedAt: null,
        }),
      });
    },
  );

  it('allows re-upload when the existing document is already uploaded (unreviewed)', async () => {
    mockPrisma.participantDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      submissionStatus: 'uploaded',
    });

    await handler.execute(command());

    expect(mockPrisma.participantDocument.update).toHaveBeenCalled();
  });
});
