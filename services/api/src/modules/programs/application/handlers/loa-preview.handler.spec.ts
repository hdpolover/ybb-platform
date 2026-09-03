import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PreviewLoaTemplateHandler, PreviewLoaTemplateQuery } from './loa-preview.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaRenderDataService } from '@modules/portal/application/services/loa-render-data.service';
import { LoaPreviewParticipantService } from '../services/loa-preview-participant.service';

const platformAdmin = {
  accessLevel: 5,
  canManageAdmins: true,
  canAssignRoles: true,
  customPermissions: [],
  role: { name: 'super_admin', permissions: ['platform_access'] },
  adminBrands: [],
  adminPrograms: [],
};
const assignedAdminFor = (programIds: string[]) => ({
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'reviewer', permissions: [] },
  adminBrands: [],
  adminPrograms: programIds.map((programId) => ({ programId, permissions: [] })),
});
const actor = { userId: 'admin-1', email: 'a@b.c', brandId: 'brand-x', adminId: 'adm-1' } as any;

describe('PreviewLoaTemplateHandler', () => {
  let handler: PreviewLoaTemplateHandler;
  let prisma: jest.Mocked<PrismaService>;
  let fileServiceClient: jest.Mocked<FileServiceClient>;
  let loaRenderDataService: jest.Mocked<LoaRenderDataService>;
  let loaPreviewParticipantService: jest.Mocked<LoaPreviewParticipantService>;
  let mockProgramRepository: any;
  let mockReadPrisma: any;

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
    // 'program-1' is not UUID-shaped, so resolveProgramId() in
    // loa-preview.handler.ts routes it through programRepository.findBySlug()
    // - mocked to resolve to itself, so the pre-existing assertions below
    // (keyed on the literal 'program-1') stay valid unchanged.
    mockProgramRepository = { findBySlug: jest.fn().mockResolvedValue({ id: 'program-1' }) };
    mockReadPrisma = {
      admin: { findUnique: jest.fn().mockResolvedValue(platformAdmin) },
      program: {
        findUnique: jest.fn().mockResolvedValue({ id: 'program-1', brandId: 'brand-x', name: 'P', deletedAt: null }),
      },
    };

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
        { provide: 'IProgramRepository', useValue: mockProgramRepository },
        { provide: PrismaReadService, useValue: mockReadPrisma },
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
      handler.execute(new PreviewLoaTemplateQuery('missing-program', '<p>draft</p>', {}, [], actor)),
    ).rejects.toThrow(NotFoundException);
  });

  // Was @Roles-gated but otherwise fully unscoped: any admin/super_admin-role
  // caller could preview any programme's Invitation Letter with a REAL
  // applicant's name, institution, nationality, birthdate, gender, email and
  // phone by passing an arbitrary programId. The assertion must run BEFORE
  // any participant data is loaded, not merely surface an error at the end -
  // asserted here by proving resolveApplicationId (where participant
  // selection happens) and generateLoa (which renders the PII) never fire.
  describe('programme scope enforcement', () => {
    it('refuses an admin outside their assigned programmes, BEFORE any participant data is read', async () => {
      mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));

      await expect(
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], actor)),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.program.findUnique).not.toHaveBeenCalled();
      expect(loaPreviewParticipantService.resolveApplicationId).not.toHaveBeenCalled();
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });

    it('lets a programme-assigned admin preview their own programme', async () => {
      mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['program-1']));
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await expect(
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], actor)),
      ).resolves.toBeDefined();

      expect(fileServiceClient.generateLoa).toHaveBeenCalled();
    });

    // Same M203-shaped bug as loa-batches: this route is reached from the
    // same admin pages (LoaTemplateEditor via useResolvedProgramId), which
    // falls back to the raw route value - a program SLUG - whenever the
    // program isn't in the caller's accessiblePrograms. assertProgramAccess
    // looks the program row up by id BEFORE its platform-scope short-circuit,
    // so a raw slug would 404 even a super admin. The mock below only
    // resolves for the id resolveProgramId() should produce - it returns null
    // for the raw slug - so this test fails if the fix regresses to asserting
    // on the unresolved identifier.
    it('resolves a SLUG to the real programme id before asserting scope, so a super admin is NOT 404d', async () => {
      const realProgramId = '123e4567-e89b-12d3-a456-426614174000';
      const slug = 'china-youth-summit-2026';

      mockProgramRepository.findBySlug.mockImplementation((identifier: string) =>
        identifier === slug ? Promise.resolve({ id: realProgramId }) : Promise.resolve(null),
      );
      mockReadPrisma.program.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        where.id === realProgramId
          ? Promise.resolve({ id: realProgramId, brandId: 'brand-x', name: 'China Youth Summit', deletedAt: null })
          : Promise.resolve(null),
      );
      (prisma.program.findUnique as jest.Mock).mockResolvedValue({ ...mockProgram, id: realProgramId });
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await expect(
        handler.execute(new PreviewLoaTemplateQuery(slug, '<p>draft</p>', {}, [], actor)),
      ).resolves.toBeDefined();

      expect(mockProgramRepository.findBySlug).toHaveBeenCalledWith(slug);
      expect(mockReadPrisma.program.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: realProgramId } }),
      );
      // The rest of the handler must also use the RESOLVED id, not the slug.
      expect(prisma.program.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: realProgramId } }),
      );
      expect(loaPreviewParticipantService.resolveApplicationId).toHaveBeenCalledWith(realProgramId, undefined);
    });
  });

  describe('source: draft (default)', () => {
    it('renders the request-body draft content without touching the persisted template', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>unsaved draft</p>', {}, [], actor));

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

      await handler.execute(
        new PreviewLoaTemplateQuery('program-1', '<p>ignored</p>', {}, [], actor, undefined, 'saved'),
      );

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
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>ignored</p>', {}, [], actor, undefined, 'saved')),
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

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], actor, 'app-42'));

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
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], actor, 'wrong-app-id')),
      ).rejects.toThrow(NotFoundException);
      expect(loaRenderDataService.buildSourceMapForApplication).not.toHaveBeenCalled();
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });

    it('falls back to SAMPLE_PARTICIPANT and PREVIEW/000 when the pool is empty', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      const result = await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], actor));

      expect(loaRenderDataService.buildSourceMapForApplication).not.toHaveBeenCalled();
      expect(result.isSample).toBe(true);
      expect(result.participantName).toBe('Jane Doe');
      expect(result.applicationId).toBeNull();
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

      const result = await handler.execute(
        new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], actor, 'app-42'),
      );

      expect(result.isSample).toBe(false);
      expect(result.participantName).toBe('Real Participant');
      expect(result.applicationId).toBe('app-42');
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ document_number: 'LOA-2026-0007' }),
      );
    });
  });

  it('surfaces file-service errors instead of swallowing them', async () => {
    (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });
    (fileServiceClient.generateLoa as jest.Mock).mockRejectedValue(new Error('file service unreachable'));

    await expect(
      handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], actor)),
    ).rejects.toThrow('file service unreachable');
  });
});
