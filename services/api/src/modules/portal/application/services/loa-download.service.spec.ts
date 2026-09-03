import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
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
          useValue: { checkEligibility: jest.fn(), resolveEligibleApplications: jest.fn() },
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
            participantApplication: { findFirst: jest.fn(), findMany: jest.fn() },
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
    (loaEligibilityService.resolveEligibleApplications as jest.Mock).mockResolvedValue([
      { application: mockApplication, batchId: 'batch-1' },
    ]);
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
      (loaEligibilityService.resolveEligibleApplications as jest.Mock).mockResolvedValue([]);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

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

    it('throws ForbiddenException when the participant has no application in this brand', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (loaEligibilityService.resolveEligibleApplications as jest.Mock).mockResolvedValue([]);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.program.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when program not found', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (loaEligibilityService.resolveEligibleApplications as jest.Mock).mockResolvedValue([
        { application: mockApplication, batchId: 'batch-1' },
      ]);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(NotFoundException);
      // Eligibility now runs BEFORE the program lookup, because eligibility is what
      // SELECTS the application rather than a gate applied after one was picked.
      // The previous assertion here (checkEligibility not called) pinned the old
      // order and is intentionally inverted.
      expect(loaEligibilityService.resolveEligibleApplications).toHaveBeenCalled();
    });

    // ─── selection by eligibility ─────────────────────────────────────────────
    //
    // The bug this replaced: pick one application with an unordered findFirst,
    // then gate it on eligibility and throw without trying another. For a
    // multi-program participant that produced a SILENT false denial - "Invitation
    // Letter not available" while an eligible acceptance sat one row over. It is
    // invisible: support cannot tell it apart from an unreleased batch.

    describe('selection by eligibility', () => {
      const otherApplication = { id: 'app-2', programId: 'prog-2' };

      it('uses the single eligible application, whatever order it came back in', async () => {
        mockHappyPath();
        (loaEligibilityService.resolveEligibleApplications as jest.Mock).mockResolvedValue([
          { application: mockApplication, batchId: 'batch-1' },
        ]);

        await service.downloadLoa('user-1', 'brand-1');

        expect(prisma.program.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: mockApplication.programId } }),
        );
      });

      it('refuses to guess when more than one application is eligible', async () => {
        mockHappyPath();
        (loaEligibilityService.resolveEligibleApplications as jest.Mock).mockResolvedValue([
          { application: mockApplication, batchId: 'b1' },
          { application: otherApplication, batchId: 'b2' },
        ]);

        await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ConflictException);
        expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
      });

      it('reports unavailable when nothing is eligible', async () => {
        mockHappyPath();
        (loaEligibilityService.resolveEligibleApplications as jest.Mock).mockResolvedValue([]);

        await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
        expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
      });

      it('passes the caller\'s brand and programme through to candidate resolution', async () => {
        mockHappyPath();

        await service.downloadLoa('user-1', 'brand-1', 'prog-1');

        expect(loaEligibilityService.resolveEligibleApplications).toHaveBeenCalledWith(
          'participant-1',
          'brand-1',
          'prog-1',
        );
      });
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
