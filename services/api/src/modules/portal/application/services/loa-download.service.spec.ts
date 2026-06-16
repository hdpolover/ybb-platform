import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LoaDownloadService } from './loa-download.service';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { PortalCacheService } from './portal-cache.service';

describe('LoaDownloadService', () => {
  let service: LoaDownloadService;
  let loaEligibilityService: jest.Mocked<LoaEligibilityService>;
  let loaDocumentNumberService: jest.Mocked<LoaDocumentNumberService>;
  let fileServiceClient: jest.Mocked<FileServiceClient>;
  let prisma: jest.Mocked<PrismaService>;
  let portalCacheService: jest.Mocked<PortalCacheService>;

  const mockParticipant = { id: 'participant-1', fullName: 'John Doe' };
  const mockApplication = {
    id: 'app-1',
    programId: 'program-1',
    status: 'accepted',
    submittedAt: new Date('2026-02-15'),
    participant: { fullName: 'John Doe' },
    participationCategory: { name: 'International' },
  };
  const mockProgram = {
    id: 'program-1',
    name: 'YBB 2026',
    year: 2026,
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-14'),
    location: 'Bali, Indonesia',
    programType: 'Exchange',
  };
  const mockTemplate = {
    id: 'template-1',
    htmlContent: '<p>Hello {{participant.fullName}}</p>',
    placeholders: [
      { key: '{{participant.fullName}}', source: 'participant.fullName' },
      { key: '{{program.name}}', source: 'program.name' },
      { key: '{{document_number}}', source: 'participant_document.documentNumber' },
    ],
    layoutConfig: {
      headerHtml: '<header>YBB</header>',
      footerHtml: '<footer>YBB Footer</footer>',
      pageSize: 'A4',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
  };
  const mockPdfBuffer = Buffer.from('PDF content');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoaDownloadService,
        {
          provide: LoaEligibilityService,
          useValue: { checkEligibility: jest.fn() },
        },
        {
          provide: LoaDocumentNumberService,
          useValue: { assignOrGet: jest.fn() },
        },
        {
          provide: FileServiceClient,
          useValue: { generateLoa: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            participant: { findUnique: jest.fn() },
            participantApplication: { findFirst: jest.fn() },
            program: { findFirst: jest.fn(), findUnique: jest.fn() },
            documentTemplate: { findFirst: jest.fn() },
            participantDocument: {
              update: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: PortalCacheService,
          useValue: { getParticipantProfile: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<LoaDownloadService>(LoaDownloadService);
    loaEligibilityService = module.get(LoaEligibilityService);
    loaDocumentNumberService = module.get(LoaDocumentNumberService);
    fileServiceClient = module.get(FileServiceClient);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    portalCacheService = module.get(PortalCacheService);
  });

  describe('downloadLoa', () => {
    it('(a) throws ForbiddenException when participant is not eligible', async () => {
      // Bug 1 fix: application resolved first, then program via findUnique on application.programId
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
      (loaEligibilityService.checkEligibility as jest.Mock).mockResolvedValue({ eligible: false });

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });

    it('(b) eligible → calls generateLoa and returns buffer with doc number in filename', async () => {
      // Bug 1 fix: application resolved first; Bug 2 fix: assignOrGet receives templateId
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);
      (loaEligibilityService.checkEligibility as jest.Mock).mockResolvedValue({ eligible: true, batchId: 'batch-1' });
      (loaDocumentNumberService.assignOrGet as jest.Mock).mockResolvedValue({
        docNumber: 'LOA-2026-0001',
        isNew: false,
        existingDocId: 'doc-1',
      });
      (fileServiceClient.generateLoa as jest.Mock).mockResolvedValue(mockPdfBuffer);
      (prisma.participantDocument.update as jest.Mock).mockResolvedValue({});
      (prisma.participantDocument.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await service.downloadLoa('user-1', 'brand-1');

      // Bug 2 regression: assignOrGet must be called with templateId
      expect(loaDocumentNumberService.assignOrGet).toHaveBeenCalledWith(
        mockApplication.id,
        mockApplication.programId,
        String(mockProgram.year),
        mockTemplate.id,
      );
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({
          html_content: expect.any(String),
          document_number: 'LOA-2026-0001',
          placeholder_data: expect.objectContaining({
            '{{document_number}}': 'LOA-2026-0001',
          }),
        }),
      );
      expect(result.buffer).toBe(mockPdfBuffer);
      expect(result.filename).toBe('LOA-LOA-2026-0001.pdf');
    });

    it('(c) records download tracking — increments downloadCount and sets lastDownloadedAt', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);
      (loaEligibilityService.checkEligibility as jest.Mock).mockResolvedValue({ eligible: true, batchId: 'batch-1' });
      (loaDocumentNumberService.assignOrGet as jest.Mock).mockResolvedValue({
        docNumber: 'LOA-2026-0001',
        isNew: false,
        existingDocId: 'doc-1',
      });
      (fileServiceClient.generateLoa as jest.Mock).mockResolvedValue(mockPdfBuffer);
      (prisma.participantDocument.update as jest.Mock).mockResolvedValue({});
      (prisma.participantDocument.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.downloadLoa('user-1', 'brand-1');

      expect(prisma.participantDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            downloadCount: { increment: 1 },
            lastDownloadedAt: expect.any(Date),
            loaReleaseBatchId: 'batch-1',
          }),
        }),
      );
      expect(prisma.participantDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1', firstDownloadedAt: null },
          data: { firstDownloadedAt: expect.any(Date) },
        }),
      );
    });

    it('throws NotFoundException when participant not found', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when application not found (inverted resolution: application first)', async () => {
      // Bug 1 fix: no program.findFirst call; ForbiddenException comes from missing application
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
      // program.findUnique must NOT be called — application resolution gate comes first
      expect(prisma.program.findUnique).not.toHaveBeenCalled();
    });
  });
});
