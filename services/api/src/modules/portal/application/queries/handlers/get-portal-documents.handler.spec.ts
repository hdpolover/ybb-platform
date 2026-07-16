import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetPortalDocumentsHandler } from './get-portal-documents.handler';
import { GetPortalDocumentsQuery } from '../portal-queries';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { LoaEligibilityService } from '../../services/loa-eligibility.service';

const USER_ID = 'user-1';
const PARTICIPANT_ID = 'participant-1';
const APPLICATION_ID = 'app-1';
const PROGRAM_ID = 'prog-1';
const LOA_TEMPLATE_ID = 'tmpl-loa-1';
const AGREEMENT_TEMPLATE_ID = 'tmpl-agr-1';

const mockParticipant = { id: PARTICIPANT_ID, userId: USER_ID };

const makeLOATemplate = () => ({
    id: LOA_TEMPLATE_ID,
    name: 'Letter of Acceptance',
    type: 'letter_of_acceptance',
    description: 'Your LOA',
    templateUrl: null,
    audienceType: 'specific_status',
    audienceConfig: { statuses: ['accepted'] },
    order: 1,
    updatedAt: new Date('2026-06-01'),
});

const makeAgreementTemplate = () => ({
    id: AGREEMENT_TEMPLATE_ID,
    name: 'Program Agreement',
    type: 'agreement_letter',
    description: 'Agreement',
    templateUrl: 'https://example.com/agreement.pdf',
    audienceType: 'all_registered',
    audienceConfig: {},
    order: 2,
    updatedAt: new Date('2026-06-01'),
});

const makeApplication = (overrides: Record<string, unknown> = {}) => ({
    id: APPLICATION_ID,
    programId: PROGRAM_ID,
    status: 'accepted',
    registrationPaymentStatus: 'paid',
    programPaymentStatus: 'unpaid',
    pricingTierId: null,
    program: {
        id: PROGRAM_ID,
        resources: [],
    },
    documents: [],
    invoices: [],
    ...overrides,
});

describe('GetPortalDocumentsHandler — LOA eligibility branch (Task 9)', () => {
    let handler: GetPortalDocumentsHandler;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockPrisma: any;
    let mockCacheService: { get: jest.Mock; set: jest.Mock };
    let mockPortalCacheService: { getParticipantProfile: jest.Mock };
    let mockLoaEligibilityService: { checkEligibility: jest.Mock };

    beforeEach(async () => {
        mockPrisma = {
            participantApplication: { findFirst: jest.fn() },
            documentTemplate: { findMany: jest.fn() },
            // resolveMaskedFileUrl calls prisma.file.findFirst to check masked URLs
            file: { findFirst: jest.fn().mockResolvedValue(null) },
        };

        mockCacheService = {
            get: jest.fn().mockResolvedValue(null), // always miss cache for tests
            set: jest.fn().mockResolvedValue(undefined),
        };

        mockPortalCacheService = {
            getParticipantProfile: jest.fn().mockResolvedValue(mockParticipant),
        };

        mockLoaEligibilityService = {
            checkEligibility: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalDocumentsHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: LoaEligibilityService, useValue: mockLoaEligibilityService },
            ],
        }).compile();

        handler = module.get(GetPortalDocumentsHandler);
    });

    // ─── LOA: eligible participant ─────────────────────────────────────────────

    it('returns downloadable=true for LOA when participant is eligible', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeLOATemplate()]);
        mockLoaEligibilityService.checkEligibility.mockResolvedValue({
            eligible: true,
            batchId: 'batch-1',
        });

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const loaDoc = result.myDocuments.find((d) => d.documentType === 'letter_of_acceptance');
        expect(loaDoc).toBeDefined();
        expect(loaDoc?.downloadable).toBe(true);
        expect(loaDoc?.fileUrl).toBeUndefined();
    });

    it('calls checkEligibility with the correct applicationId and programId', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeLOATemplate()]);
        mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: true, batchId: 'batch-1' });

        await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        expect(mockLoaEligibilityService.checkEligibility).toHaveBeenCalledWith(APPLICATION_ID, PROGRAM_ID);
    });

    it('includes existing documentNumber in LOA entry when a participant doc row with templateId exists', async () => {
        // Bug 2 regression: doc row must have templateId set so handler can match it
        const existingDoc = {
            id: 'doc-loa-1',
            name: 'Letter of Acceptance',
            type: 'letter_of_acceptance',
            fileUrl: null,
            signedCopyUrl: null,
            submissionStatus: null,
            submissionNote: null,
            generatedAt: new Date('2026-06-15'),
            templateId: LOA_TEMPLATE_ID,   // must match template id — row must have this set
            documentNumber: 'LOA-YBB2026-0001',
            downloadCount: 2,
            firstDownloadedAt: new Date('2026-06-15'),
        };

        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            makeApplication({ documents: [existingDoc] }),
        );
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeLOATemplate()]);
        mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: true, batchId: 'batch-1' });

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const loaDoc = result.myDocuments.find((d) => d.documentType === 'letter_of_acceptance');
        expect(loaDoc?.documentNumber).toBe('LOA-YBB2026-0001');
        expect(loaDoc?.downloadable).toBe(true);
    });

    it('LOA appears exactly ONCE in myDocuments when a download row with templateId exists (no duplicate)', async () => {
        // Bug 2 regression: without templateId on the row, the uploaded-docs loop at step 3
        // sees doc.templateId===null → does NOT skip → emits a second entry. This test proves
        // that after the fix (templateId set on the row), exactly one LOA item is emitted.
        const existingDoc = {
            id: 'doc-loa-1',
            name: 'Letter of Acceptance',
            type: 'letter_of_acceptance',
            fileUrl: null,
            signedCopyUrl: null,
            submissionStatus: null,
            submissionNote: null,
            generatedAt: new Date('2026-06-15'),
            templateId: LOA_TEMPLATE_ID,   // fixed: row now carries templateId
            documentNumber: 'LOA-YBB2026-0001',
            downloadCount: 1,
            firstDownloadedAt: new Date('2026-06-15'),
        };

        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            makeApplication({ documents: [existingDoc] }),
        );
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeLOATemplate()]);
        mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: true, batchId: 'batch-1' });

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const loaDocs = result.myDocuments.filter((d) => d.documentType === 'letter_of_acceptance');
        expect(loaDocs).toHaveLength(1);  // exactly one — no dup from uploaded-docs loop
    });

    // ─── LOA: ineligible participant ───────────────────────────────────────────

    it('returns downloadable=false (locked) for LOA when participant is NOT eligible', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeLOATemplate()]);
        mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: false });

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const loaDoc = result.myDocuments.find((d) => d.documentType === 'letter_of_acceptance');
        expect(loaDoc).toBeDefined();
        expect(loaDoc?.downloadable).toBe(false);
        expect(loaDoc?.fileUrl).toBeUndefined();
    });

    it('surfaces LOA as locked even when no existing participantDoc row (no fileUrl needed)', async () => {
        // Application has no documents at all — old code would have hidden the LOA entry
        mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication({ documents: [] }));
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeLOATemplate()]);
        mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: false });

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const loaDoc = result.myDocuments.find((d) => d.documentType === 'letter_of_acceptance');
        expect(loaDoc).toBeDefined(); // Must appear even with no fileUrl
        expect(loaDoc?.downloadable).toBe(false);
    });

    // ─── Other document types: unchanged ──────────────────────────────────────

    it('still pushes agreement_letter correctly and does not call checkEligibility for it', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeAgreementTemplate()]);

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        expect(mockLoaEligibilityService.checkEligibility).not.toHaveBeenCalled();
        const agreementDoc = result.myDocuments.find((d) => d.documentType === 'agreement_letter');
        expect(agreementDoc).toBeDefined();
        expect(agreementDoc?.status).toBe('pending_upload');
    });

    it('handles both LOA and agreement_letter templates in same program correctly', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
        mockPrisma.documentTemplate.findMany.mockResolvedValue([
            makeLOATemplate(),
            makeAgreementTemplate(),
        ]);
        mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: true, batchId: 'batch-1' });

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        expect(result.myDocuments).toHaveLength(2);
        const loaDoc = result.myDocuments.find((d) => d.documentType === 'letter_of_acceptance');
        const agreementDoc = result.myDocuments.find((d) => d.documentType === 'agreement_letter');
        expect(loaDoc?.downloadable).toBe(true);
        expect(agreementDoc?.documentType).toBe('agreement_letter');
        // LOA eligibility only checked once, not for agreement
        expect(mockLoaEligibilityService.checkEligibility).toHaveBeenCalledTimes(1);
    });

    // ─── Edge cases ────────────────────────────────────────────────────────────

    it('throws NotFoundException when participant not found', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue(null);

        await expect(handler.execute(new GetPortalDocumentsQuery(USER_ID))).rejects.toThrow(
            NotFoundException,
        );
    });

    it('returns empty documents arrays when no application exists', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        expect(result.programResources).toHaveLength(0);
        expect(result.myDocuments).toHaveLength(0);
    });
});
