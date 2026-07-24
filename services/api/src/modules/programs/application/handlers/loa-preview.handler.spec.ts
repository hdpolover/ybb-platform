import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PreviewLoaTemplateHandler, PreviewLoaTemplateQuery } from './loa-preview.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaRenderDataService } from '@modules/portal/application/services/loa-render-data.service';
import { LoaPreviewParticipantService } from '../services/loa-preview-participant.service';

describe('PreviewLoaTemplateHandler', () => {
  let handler: PreviewLoaTemplateHandler;
  let prisma: jest.Mocked<PrismaService>;
  let fileServiceClient: jest.Mocked<FileServiceClient>;
  let loaRenderDataService: jest.Mocked<LoaRenderDataService>;
  let loaPreviewParticipantService: jest.Mocked<LoaPreviewParticipantService>;

  const mockProgram = {
    id: 'program-1',
    name: 'Japan Youth Summit 2026 Batch 2',
    year: 2026,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-10'),
    location: 'Tokyo, Japan',
    theme: 'Unity',
    brand: { name: 'YBB Foundation' },
  };
  const mockSavedTemplate = {
    htmlContent: '<p>Saved {{participant_name}}</p>',
    placeholders: [{ key: '{{participant_name}}', source: 'participant.fullName' }],
    layoutConfig: { pageSize: 'A4' },
  };
  const mockRenderData = {
    sourceMap: { 'participant.fullName': 'Real Participant' },
    programDisplayName: 'Japan Youth Summit 2026',
    programBatch: '2',
  };
  const mockPdfBuffer = Buffer.from('PDF content');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewLoaTemplateHandler,
        {
          provide: PrismaService,
          useValue: {
            program: { findUnique: jest.fn() },
            documentTemplate: { findFirst: jest.fn() },
            signature: { findFirst: jest.fn() },
          },
        },
        { provide: FileServiceClient, useValue: { generateLoa: jest.fn() } },
        { provide: LoaRenderDataService, useValue: { buildSourceMapForApplication: jest.fn() } },
        {
          provide: LoaPreviewParticipantService,
          useValue: { resolveApplicationId: jest.fn(), resolveDocumentNumber: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get(PreviewLoaTemplateHandler);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    fileServiceClient = module.get(FileServiceClient);
    loaRenderDataService = module.get(LoaRenderDataService);
    loaPreviewParticipantService = module.get(LoaPreviewParticipantService);

    (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
    (fileServiceClient.generateLoa as jest.Mock).mockResolvedValue(mockPdfBuffer);
  });

  it('throws NotFoundException when the program does not exist', async () => {
    (prisma.program.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      handler.execute(new PreviewLoaTemplateQuery('missing-program', '<p>draft</p>', {}, [])),
    ).rejects.toThrow(NotFoundException);
  });

  describe('source: draft (default)', () => {
    it('renders the request-body draft content without touching the persisted template', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>unsaved draft</p>', {}, []));

      expect(prisma.documentTemplate.findFirst).not.toHaveBeenCalled();
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ html_content: '<p>unsaved draft</p>' }),
      );
    });
  });

  describe('source: saved', () => {
    it('renders the persisted active template when one exists', async () => {
      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(mockSavedTemplate);
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>ignored</p>', {}, [], undefined, 'saved'));

      expect(prisma.documentTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId: 'program-1', type: 'letter_of_acceptance', isActive: true, deletedAt: null },
        }),
      );
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ html_content: '<p>Saved {{participant_name}}</p>' }),
      );
    });

    it('throws ConflictException (409) when no active template is published', async () => {
      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(null);
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await expect(
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>ignored</p>', {}, [], undefined, 'saved')),
      ).rejects.toThrow(ConflictException);
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });
  });

  describe('participant resolution', () => {
    it('uses the explicit applicationId and calls LoaRenderDataService with it', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({
        isSample: false,
        applicationId: 'app-42',
      });
      (loaPreviewParticipantService.resolveDocumentNumber as jest.Mock).mockResolvedValue('LOA-2026-0007');
      (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mockResolvedValue(mockRenderData);

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], 'app-42'));

      expect(loaPreviewParticipantService.resolveApplicationId).toHaveBeenCalledWith('program-1', 'app-42');
      expect(loaRenderDataService.buildSourceMapForApplication).toHaveBeenCalledWith(
        'app-42',
        expect.objectContaining({ documentNumber: 'LOA-2026-0007' }),
      );
    });

    it('propagates NotFoundException from participant resolution for a wrong/missing applicationId, without falling back to auto-pick', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockRejectedValue(
        new NotFoundException('Application not found for this program'),
      );

      await expect(
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], 'wrong-app-id')),
      ).rejects.toThrow(NotFoundException);
      expect(loaRenderDataService.buildSourceMapForApplication).not.toHaveBeenCalled();
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });

    it('falls back to SAMPLE_PARTICIPANT and PREVIEW/000 when the pool is empty', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      const result = await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, []));

      expect(loaRenderDataService.buildSourceMapForApplication).not.toHaveBeenCalled();
      expect(result.isSample).toBe(true);
      expect(result.participantName).toBe('Jane Doe');
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ document_number: 'PREVIEW/000' }),
      );
    });

    it('returns the real participant name and isSample: false for a resolved application', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({
        isSample: false,
        applicationId: 'app-42',
      });
      (loaPreviewParticipantService.resolveDocumentNumber as jest.Mock).mockResolvedValue('LOA-2026-0007');
      (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mockResolvedValue(mockRenderData);

      const result = await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], 'app-42'));

      expect(result.isSample).toBe(false);
      expect(result.participantName).toBe('Real Participant');
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ document_number: 'LOA-2026-0007' }),
      );
    });
  });

  it('surfaces file-service errors instead of swallowing them', async () => {
    (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });
    (fileServiceClient.generateLoa as jest.Mock).mockRejectedValue(new Error('file service unreachable'));

    await expect(
      handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [])),
    ).rejects.toThrow('file service unreachable');
  });
});
