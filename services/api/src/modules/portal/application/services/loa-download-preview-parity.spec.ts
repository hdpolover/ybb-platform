import { Test, TestingModule } from '@nestjs/testing';
import { LoaDownloadService } from './loa-download.service';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { LoaRenderDataService } from './loa-render-data.service';
import { PortalCacheService } from './portal-cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import type { GenerateLoaParams } from '@modules/files/infrastructure/clients/file-service.client';
import { PreviewLoaTemplateHandler, PreviewLoaTemplateQuery } from '@modules/programs/application/handlers/loa-preview.handler';
import { LoaPreviewParticipantService } from '@modules/programs/application/services/loa-preview-participant.service';

const platformAdmin = {
  accessLevel: 5,
  canManageAdmins: true,
  canAssignRoles: true,
  customPermissions: [],
  role: { name: 'super_admin', permissions: ['platform_access'] },
  adminBrands: [],
  adminPrograms: [],
};
const parityActor = { userId: 'admin-1', email: 'a@b.c', brandId: 'brand-x', adminId: 'adm-1' } as any;

describe('LOA preview/download parity', () => {
  const applicationId = 'app-parity-1';
  const programId = 'program-parity-1';
  const templateId = 'template-parity-1';

  const fixtureApplication = {
    id: applicationId,
    programId,
    personalData: {
      institution: 'Harvard University',
      nationality: 'American',
      major: 'Computer Science',
      occupation: 'Student',
    },
    participant: {
      fullName: 'Parity Participant',
      institution: '',
      nationality: '',
      birthdate: new Date('2001-03-15'),
      gender: 'female',
      originCountry: 'Indonesia',
      phoneCountryCode: '+62',
      phoneNumber: '81234567890',
      major: '',
      occupation: '',
      user: { email: 'parity@example.com' },
    },
    participationCategory: { name: 'International Delegate' },
  };

  const fixtureProgram = {
    id: programId,
    name: 'Japan Youth Summit 2026 Batch 2',
    year: 2026,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-10'),
    location: 'Tokyo, Japan',
    theme: 'Unity in Diversity',
    brand: { name: 'YBB Foundation' },
  };

  const fixtureTemplate = {
    id: templateId,
    htmlContent: '<p>Dear {{participant_name}}</p>',
    placeholders: [
      { key: '{{participant_name}}', label: 'Participant Full Name', source: 'participant.fullName' },
      { key: '{{institution}}', label: 'Institution', source: 'participant.institution' },
      { key: '{{document_number}}', label: 'Document Number', source: 'participant_document.documentNumber' },
    ],
    layoutConfig: {
      headerHtml: '<header>Header</header>',
      footerHtml: '<footer>Footer</footer>',
      pageSize: 'A4',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      signatureUrl: 'https://example.com/sig.png',
      // These five were previously omitted from this fixture, which let the
      // parity test stay green even if reading one of them diverged between
      // the two call sites (both would collapse to the same buildGenerateLoaParams
      // default). See resolveLoaLayoutConfig - populating all nine fields the
      // cast reads, including `header`, makes the test actually constrain it.
      logoUrl: 'https://example.com/logo.png',
      stampUrl: 'https://example.com/stamp.png',
      footerNote: 'This document is computer-generated.',
      showGeneratedDate: true,
      header: {
        tagline: 'Empowering Youth Leaders',
        website: 'ybb.foundation',
        email: 'info@ybb.foundation',
        phone: '+62 21 000 0000',
      },
    },
  };

  function makeMockPrisma() {
    return {
      participantApplication: {
        findFirst: jest.fn().mockResolvedValue(fixtureApplication),
        findMany: jest.fn().mockResolvedValue([fixtureApplication]),
      },
      program: { findUnique: jest.fn().mockResolvedValue(fixtureProgram) },
      documentTemplate: { findFirst: jest.fn().mockResolvedValue(fixtureTemplate) },
      participantDocument: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      signature: { findFirst: jest.fn() },
    };
  }

  function stripDocumentNumber(params: GenerateLoaParams) {
    const { document_number: _documentNumber, placeholder_data, ...rest } = params;
    const { '{{document_number}}': _placeholderDocNumber, ...restPlaceholders } = placeholder_data;
    void _documentNumber;
    void _placeholderDocNumber;
    return { ...rest, placeholder_data: restPlaceholders };
  }

  it('produces identical GenerateLoaParams for download vs preview(source=saved), excluding only document_number', async () => {
    // ── Download side ──────────────────────────────────────────────────
    const downloadPrisma = makeMockPrisma();
    const downloadFileServiceClient = { generateLoa: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    const downloadModule: TestingModule = await Test.createTestingModule({
      providers: [
        LoaDownloadService,
        LoaRenderDataService,
        { provide: PrismaService, useValue: downloadPrisma },
        { provide: PortalCacheService, useValue: { getParticipantProfile: jest.fn().mockResolvedValue({ id: 'participant-parity-1' }) } },
        {
          provide: LoaEligibilityService,
          useValue: {
            checkEligibility: jest.fn().mockResolvedValue({ eligible: true, batchId: 'batch-1' }),
            resolveEligibleApplications: jest
              .fn()
              .mockResolvedValue([{ application: fixtureApplication, batchId: 'batch-1' }]),
          },
        },
        {
          provide: LoaDocumentNumberService,
          useValue: {
            assignOrGet: jest.fn().mockResolvedValue({ docNumber: 'LOA-2026-0099', isNew: true, existingDocId: 'doc-parity-1' }),
          },
        },
        { provide: FileServiceClient, useValue: downloadFileServiceClient },
      ],
    }).compile();
    const downloadService = downloadModule.get(LoaDownloadService);
    await downloadService.downloadLoa('user-parity-1', 'brand-parity-1');
    const downloadParams: GenerateLoaParams = downloadFileServiceClient.generateLoa.mock.calls[0][0];

    // ── Preview (source=saved) side ────────────────────────────────────
    const previewPrisma = makeMockPrisma();
    const previewFileServiceClient = { generateLoa: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    const previewModule: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewLoaTemplateHandler,
        LoaRenderDataService,
        { provide: PrismaService, useValue: previewPrisma },
        { provide: FileServiceClient, useValue: previewFileServiceClient },
        {
          provide: LoaPreviewParticipantService,
          useValue: {
            resolveApplicationId: jest.fn().mockResolvedValue({ isSample: false, applicationId }),
            resolveDocumentNumber: jest.fn().mockResolvedValue('PREVIEW/000'),
          },
        },
        { provide: 'IProgramRepository', useValue: { findBySlug: jest.fn().mockResolvedValue({ id: programId }) } },
        {
          provide: PrismaReadService,
          useValue: {
            admin: { findUnique: jest.fn().mockResolvedValue(platformAdmin) },
            program: {
              findUnique: jest.fn().mockResolvedValue({ id: programId, brandId: 'brand-x', name: 'P', deletedAt: null }),
            },
          },
        },
      ],
    }).compile();
    const previewHandler = previewModule.get(PreviewLoaTemplateHandler);
    await previewHandler.execute(
      new PreviewLoaTemplateQuery(programId, '<p>ignored - source is saved</p>', {}, [], parityActor, applicationId, 'saved'),
    );
    const previewParams: GenerateLoaParams = previewFileServiceClient.generateLoa.mock.calls[0][0];

    // ── Parity ──────────────────────────────────────────────────────────
    expect(previewParams.document_number).toBe('PREVIEW/000');
    expect(downloadParams.document_number).toBe('LOA-2026-0099');
    expect(previewParams.document_number).not.toBe(downloadParams.document_number);

    expect(stripDocumentNumber(previewParams)).toEqual(stripDocumentNumber(downloadParams));
  });
});
