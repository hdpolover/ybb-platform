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

    it('splits "Program Name Batch N" into header.program_name/header.batch, and degrades new placeholders to "" (never "null"/"undefined") when participant fields are missing', async () => {
      const applicationWithNullableFields = {
        ...mockApplication,
        participant: {
          fullName: 'John Doe',
          // institution/nationality/birthdate/gender/originCountry/phoneCountryCode/
          // phoneNumber/major/occupation/user all intentionally absent to exercise the
          // null-guard fallback on every new placeholder.
        },
      };
      const programWithBatchSuffix = { ...mockProgram, name: 'Japan Youth Summit 2026 Batch 2' };
      const templateWithNewTokens = {
        ...mockTemplate,
        placeholders: [
          ...mockTemplate.placeholders,
          { key: '{{batch}}', source: 'program.batch' },
          { key: '{{nationality}}', source: 'participant.nationality' },
          { key: '{{date_of_birth}}', source: 'participant.birthdate' },
          { key: '{{gender}}', source: 'participant.gender' },
          { key: '{{country_of_origin}}', source: 'participant.originCountry' },
          { key: '{{signer_name}}', source: 'signer_name' },
          { key: '{{signer_title}}', source: 'signer_title' },
          { key: '{{program_year}}', source: 'program.year' },
          { key: '{{participant_email}}', source: 'participant.email' },
          { key: '{{participant_phone}}', source: 'participant.phone' },
          { key: '{{major}}', source: 'participant.major' },
          { key: '{{occupation}}', source: 'participant.occupation' },
        ],
        layoutConfig: { ...mockTemplate.layoutConfig, header: { tagline: '', website: '', email: '', phone: '' } },
      };

      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(applicationWithNullableFields);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(programWithBatchSuffix);
      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(templateWithNewTokens);
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

      const call = (fileServiceClient.generateLoa as jest.Mock).mock.calls[0][0];

      // Header title is split: stripped name + parsed batch token
      expect(call.header).toMatchObject({ program_name: 'Japan Youth Summit 2026', batch: '2' });

      // Every new token degrades to '' — never the literal string "null"/"undefined"
      expect(call.placeholder_data['{{batch}}']).toBe('2');
      expect(call.placeholder_data['{{nationality}}']).toBe('');
      expect(call.placeholder_data['{{date_of_birth}}']).toBe('');
      expect(call.placeholder_data['{{gender}}']).toBe('');
      expect(call.placeholder_data['{{country_of_origin}}']).toBe('');
      expect(call.placeholder_data['{{signer_name}}']).toBe('');
      expect(call.placeholder_data['{{signer_title}}']).toBe('');
      expect(call.placeholder_data['{{program_year}}']).toBe('2026');
      expect(call.placeholder_data['{{participant_email}}']).toBe('');
      expect(call.placeholder_data['{{participant_phone}}']).toBe('');
      expect(call.placeholder_data['{{major}}']).toBe('');
      expect(call.placeholder_data['{{occupation}}']).toBe('');

      for (const value of Object.values(call.placeholder_data)) {
        expect(value).not.toBe('null');
        expect(value).not.toBe('undefined');
      }
    });

    // Bug fix: participants.institution/nationality/major/occupation are 100% empty
    // across all 13,199 prod participants — real values live in
    // participant_applications.personal_data. These cases pin the personal_data-first,
    // participant-column-fallback behavior.
    describe('personalData fallback for institution/nationality/major/occupation', () => {
      const templateWithPersonalDataTokens = {
        ...mockTemplate,
        placeholders: [
          ...mockTemplate.placeholders,
          { key: '{{institution}}', source: 'participant.institution' },
          { key: '{{nationality}}', source: 'participant.nationality' },
          { key: '{{major}}', source: 'participant.major' },
          { key: '{{occupation}}', source: 'participant.occupation' },
          { key: '{{gender}}', source: 'participant.gender' },
        ],
      };

      function mockPipeline(application: unknown, template: unknown = templateWithPersonalDataTokens) {
        (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
        (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(application);
        (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
        (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(template);
        (loaEligibilityService.checkEligibility as jest.Mock).mockResolvedValue({ eligible: true, batchId: 'batch-1' });
        (loaDocumentNumberService.assignOrGet as jest.Mock).mockResolvedValue({
          docNumber: 'LOA-2026-0001',
          isNew: false,
          existingDocId: 'doc-1',
        });
        (fileServiceClient.generateLoa as jest.Mock).mockResolvedValue(mockPdfBuffer);
        (prisma.participantDocument.update as jest.Mock).mockResolvedValue({});
        (prisma.participantDocument.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      }

      it('(a) takes institution/nationality/major/occupation from personalData when present', async () => {
        mockPipeline({
          ...mockApplication,
          personalData: {
            institution: 'Harvard University',
            nationality: 'American',
            major: 'Computer Science',
            occupation: 'Student',
          },
          // Dead columns — empty, as they are for every participant in prod.
          participant: { fullName: 'John Doe', institution: '', nationality: '', major: '', occupation: '', gender: 'male' },
        });

        await service.downloadLoa('user-1', 'brand-1');

        const call = (fileServiceClient.generateLoa as jest.Mock).mock.calls[0][0];
        expect(call.placeholder_data['{{institution}}']).toBe('Harvard University');
        expect(call.placeholder_data['{{nationality}}']).toBe('American');
        expect(call.placeholder_data['{{major}}']).toBe('Computer Science');
        expect(call.placeholder_data['{{occupation}}']).toBe('Student');
      });

      it('(b) falls back to the participant column when personalData lacks the key or is null', async () => {
        mockPipeline({
          ...mockApplication,
          personalData: { institution: 'Harvard University' }, // nationality/major/occupation absent
          participant: {
            fullName: 'John Doe',
            institution: 'Should Be Overridden',
            nationality: 'Indonesian',
            major: 'Biology',
            occupation: 'Engineer',
            gender: 'male',
          },
        });

        await service.downloadLoa('user-1', 'brand-1');

        const call = (fileServiceClient.generateLoa as jest.Mock).mock.calls[0][0];
        expect(call.placeholder_data['{{institution}}']).toBe('Harvard University'); // present in personalData
        expect(call.placeholder_data['{{nationality}}']).toBe('Indonesian'); // fallback
        expect(call.placeholder_data['{{major}}']).toBe('Biology'); // fallback
        expect(call.placeholder_data['{{occupation}}']).toBe('Engineer'); // fallback
      });

      it('(b2) falls back to the participant column when personalData itself is null', async () => {
        mockPipeline({
          ...mockApplication,
          personalData: null,
          participant: {
            fullName: 'John Doe',
            institution: 'Fallback University',
            nationality: 'Indonesian',
            major: 'Biology',
            occupation: 'Engineer',
            gender: 'male',
          },
        });

        await service.downloadLoa('user-1', 'brand-1');

        const call = (fileServiceClient.generateLoa as jest.Mock).mock.calls[0][0];
        expect(call.placeholder_data['{{institution}}']).toBe('Fallback University');
        expect(call.placeholder_data['{{nationality}}']).toBe('Indonesian');
        expect(call.placeholder_data['{{major}}']).toBe('Biology');
        expect(call.placeholder_data['{{occupation}}']).toBe('Engineer');
      });

      it('(c) treats a whitespace-only personalData value as absent and falls back rather than rendering blank', async () => {
        mockPipeline({
          ...mockApplication,
          personalData: { institution: '   ', nationality: '\t', major: '', occupation: '  ' },
          participant: {
            fullName: 'John Doe',
            institution: 'Fallback University',
            nationality: 'Indonesian',
            major: 'Biology',
            occupation: 'Engineer',
            gender: 'male',
          },
        });

        await service.downloadLoa('user-1', 'brand-1');

        const call = (fileServiceClient.generateLoa as jest.Mock).mock.calls[0][0];
        expect(call.placeholder_data['{{institution}}']).toBe('Fallback University');
        expect(call.placeholder_data['{{nationality}}']).toBe('Indonesian');
        expect(call.placeholder_data['{{major}}']).toBe('Biology');
        expect(call.placeholder_data['{{occupation}}']).toBe('Engineer');
      });

      it('(d) leaves an already-correct participant field (fullName, gender) unchanged', async () => {
        mockPipeline({
          ...mockApplication,
          personalData: {
            institution: 'Harvard University',
            nationality: 'American',
            major: 'Computer Science',
            occupation: 'Student',
          },
          participant: { fullName: 'Jane Smith', institution: '', nationality: '', major: '', occupation: '', gender: 'female' },
        });

        await service.downloadLoa('user-1', 'brand-1');

        const call = (fileServiceClient.generateLoa as jest.Mock).mock.calls[0][0];
        expect(call.placeholder_data['{{participant.fullName}}']).toBe('Jane Smith');
        expect(call.placeholder_data['{{gender}}']).toBe('Female');
      });
    });
  });
});
