import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LoaDownloadService } from './loa-download.service';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { LoaRenderDataService } from './loa-render-data.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { PortalCacheService } from './portal-cache.service';

describe('LoaDownloadService', () => {
  let service: LoaDownloadService;
  let loaEligibilityService: jest.Mocked<LoaEligibilityService>;
  let loaDocumentNumberService: jest.Mocked<LoaDocumentNumberService>;
  let loaRenderDataService: jest.Mocked<LoaRenderDataService>;
  let fileServiceClient: jest.Mocked<FileServiceClient>;
  let prisma: jest.Mocked<PrismaService>;
  let portalCacheService: jest.Mocked<PortalCacheService>;

  const mockParticipant = { id: 'participant-1', fullName: 'John Doe' };
  const mockApplication = { id: 'app-1', programId: 'program-1' };
  const mockProgram = { id: 'program-1', year: 2026 };
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
  const mockRenderData = {
    sourceMap: {
      'participant.fullName': 'John Doe',
      'program.name': 'YBB 2026',
      'participant_document.documentNumber': 'LOA-2026-0001',
    },
    programDisplayName: 'YBB 2026',
    programBatch: '',
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
          provide: LoaRenderDataService,
          useValue: { buildSourceMapForApplication: jest.fn() },
        },
        {
          provide: FileServiceClient,
          useValue: { generateLoa: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            participantApplication: { findFirst: jest.fn() },
            program: { findUnique: jest.fn() },
            documentTemplate: { findFirst: jest.fn() },
            participantDocument: {
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            signature: { findFirst: jest.fn() },
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
    loaRenderDataService = module.get(LoaRenderDataService);
    fileServiceClient = module.get(FileServiceClient);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    portalCacheService = module.get(PortalCacheService);
  });

  function mockHappyPath() {
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
    (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mockResolvedValue(mockRenderData);
    (fileServiceClient.generateLoa as jest.Mock).mockResolvedValue(mockPdfBuffer);
    (prisma.participantDocument.update as jest.Mock).mockResolvedValue({});
    (prisma.participantDocument.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  }

  describe('downloadLoa', () => {
    it('(a) throws ForbiddenException when participant is not eligible', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
      (loaEligibilityService.checkEligibility as jest.Mock).mockResolvedValue({ eligible: false });

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });

    it('(b) eligible → calls generateLoa and returns buffer with doc number in filename', async () => {
      mockHappyPath();

      const result = await service.downloadLoa('user-1', 'brand-1');

      expect(loaDocumentNumberService.assignOrGet).toHaveBeenCalledWith(
        mockApplication.id,
        mockApplication.programId,
        String(mockProgram.year),
        mockTemplate.id,
      );
      expect(loaRenderDataService.buildSourceMapForApplication).toHaveBeenCalledWith(
        mockApplication.id,
        expect.objectContaining({ documentNumber: 'LOA-2026-0001' }),
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

    it('(c) records download tracking - increments downloadCount and sets lastDownloadedAt', async () => {
      mockHappyPath();

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
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.program.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when program not found', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(NotFoundException);
      expect(loaEligibilityService.checkEligibility).not.toHaveBeenCalled();
    });

    it('delegates the flat placeholder-source-map construction entirely to LoaRenderDataService, passing documentNumber/signerName/signerTitle', async () => {
      mockHappyPath();

      await service.downloadLoa('user-1', 'brand-1');

      expect(loaRenderDataService.buildSourceMapForApplication).toHaveBeenCalledTimes(1);
      const [calledApplicationId, calledOpts] = (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mock.calls[0];
      expect(calledApplicationId).toBe('app-1');
      expect(calledOpts).toEqual(
        expect.objectContaining({
          documentNumber: 'LOA-2026-0001',
          signerName: expect.any(String),
          signerTitle: expect.any(String),
        }),
      );
    });
  });
});
