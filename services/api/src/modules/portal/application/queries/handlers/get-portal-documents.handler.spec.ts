import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetPortalDocumentsHandler } from './get-portal-documents.handler';
import { GetPortalDocumentsQuery } from '../portal-queries';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { LoaEligibilityService } from '../../services/loa-eligibility.service';
import { DocumentAudienceService } from '../../services/document-audience.service';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '@modules/files/application/private-file-url-resolver.service';

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
    let mockPrivateFileUrlResolver: { resolve: jest.Mock };

    beforeEach(async () => {
        mockPrisma = {
            participantApplication: { findFirst: jest.fn() },
            documentTemplate: { findMany: jest.fn() },
            // url masking does one batched prisma.file.findMany for every document url
            file: { findMany: jest.fn().mockResolvedValue([]) },
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

        // Default: "not a private-category file" — preserves the existing
        // resolveMaskedFileUrl behavior for tests that don't care about presigning.
        mockPrivateFileUrlResolver = {
            resolve: jest.fn().mockResolvedValue(null),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalDocumentsHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: LoaEligibilityService, useValue: mockLoaEligibilityService },
                { provide: PrivateFileUrlResolver, useValue: mockPrivateFileUrlResolver },
                DocumentAudienceService,
            ],
        }).compile();

        handler = module.get(GetPortalDocumentsHandler);
    });

    // ─── programId scoping ────────────────────────────────────────────────────
    //
    // The portal and the Next proxy both already sent programId; the API used to
    // drop it, so a multi-program participant could be shown another program's
    // documents. Nothing pinned that, which is why it survived.

    describe('programId scoping', () => {
        it('scopes the application lookup to the programId the caller sent', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
            mockPrisma.documentTemplate.findMany.mockResolvedValue([]);

            await handler.execute(new GetPortalDocumentsQuery(USER_ID, PROGRAM_ID));

            const args = mockPrisma.participantApplication.findFirst.mock.calls[0][0];
            expect(args.where).toMatchObject({ participantId: PARTICIPANT_ID, programId: PROGRAM_ID });
        });

        it('reads and writes a program-scoped cache key, so one program cannot serve another\'s documents', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
            mockPrisma.documentTemplate.findMany.mockResolvedValue([]);

            await handler.execute(new GetPortalDocumentsQuery(USER_ID, PROGRAM_ID));

            expect(mockCacheService.get).toHaveBeenCalledWith(expect.stringContaining(PROGRAM_ID));
            expect(mockCacheService.set).toHaveBeenCalledWith(
                expect.stringContaining(PROGRAM_ID),
                expect.anything(),
                expect.anything(),
            );
        });

        it('never returns a soft-deleted application, and orders withdrawn ones last', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApplication());
            mockPrisma.documentTemplate.findMany.mockResolvedValue([]);

            await handler.execute(new GetPortalDocumentsQuery(USER_ID));

            const args = mockPrisma.participantApplication.findFirst.mock.calls[0][0];
            expect(args.where).toMatchObject({ deletedAt: null });
            expect(args.orderBy[0]).toEqual({ withdrawnAt: { sort: 'asc', nulls: 'first' } });
        });
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

describe('GetPortalDocumentsHandler — private file presigning', () => {
    let handler: GetPortalDocumentsHandler;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockPrisma: any;
    let mockCacheService: { get: jest.Mock; set: jest.Mock };
    let mockPortalCacheService: { getParticipantProfile: jest.Mock };
    let mockLoaEligibilityService: { checkEligibility: jest.Mock };
    let mockPrivateFileUrlResolver: { resolve: jest.Mock };

    const PRIVATE_TEMPLATE_URL = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/agreement.pdf';
    const PRIVATE_SIGNED_COPY_URL = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/signed-copies/signed.pdf';
    const PUBLIC_MARKETING_URL = 'https://example.com/agreement.pdf';
    const PRESIGNED_URL = 'https://storage.example.com/signed?X-Amz-Signature=abc';

    beforeEach(async () => {
        mockPrisma = {
            participantApplication: { findFirst: jest.fn() },
            documentTemplate: { findMany: jest.fn() },
            file: { findMany: jest.fn().mockResolvedValue([]) },
        };

        mockCacheService = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
        };

        mockPortalCacheService = {
            getParticipantProfile: jest.fn().mockResolvedValue(mockParticipant),
        };

        mockLoaEligibilityService = { checkEligibility: jest.fn() };

        mockPrivateFileUrlResolver = { resolve: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalDocumentsHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: LoaEligibilityService, useValue: mockLoaEligibilityService },
                { provide: PrivateFileUrlResolver, useValue: mockPrivateFileUrlResolver },
                DocumentAudienceService,
            ],
        }).compile();

        handler = module.get(GetPortalDocumentsHandler);
    });

    it('presigns a private (documents category) template fileUrl', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            makeApplication({ documents: [] }),
        );
        mockPrisma.documentTemplate.findMany.mockResolvedValue([
            { ...makeAgreementTemplate(), templateUrl: PRIVATE_TEMPLATE_URL },
        ]);
        mockPrivateFileUrlResolver.resolve.mockImplementation(async (url: string) =>
            url === PRIVATE_TEMPLATE_URL ? PRESIGNED_URL : null,
        );

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const agreementDoc = result.myDocuments.find((d) => d.documentType === 'agreement_letter');
        expect(agreementDoc?.fileUrl).toBe(PRESIGNED_URL);
    });

    it('presigns a private (signed-copies category) signedCopyUrl', async () => {
        const existingDoc = {
            id: 'doc-agr-1',
            name: 'Program Agreement',
            type: 'agreement_letter',
            fileUrl: null,
            signedCopyUrl: PRIVATE_SIGNED_COPY_URL,
            submissionStatus: 'under_review',
            submissionNote: null,
            generatedAt: new Date('2026-06-15'),
            templateId: AGREEMENT_TEMPLATE_ID,
            documentNumber: undefined,
            downloadCount: 0,
            firstDownloadedAt: null,
        };

        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            makeApplication({ documents: [existingDoc] }),
        );
        mockPrisma.documentTemplate.findMany.mockResolvedValue([makeAgreementTemplate()]);
        mockPrivateFileUrlResolver.resolve.mockImplementation(async (url: string) =>
            url === PRIVATE_SIGNED_COPY_URL ? PRESIGNED_URL : null,
        );

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const agreementDoc = result.myDocuments.find((d) => d.documentType === 'agreement_letter');
        expect(agreementDoc?.signedCopyUrl).toBe(PRESIGNED_URL);
    });

    it('leaves a public/marketing url unchanged when it is not a private-category file', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            makeApplication({ documents: [] }),
        );
        mockPrisma.documentTemplate.findMany.mockResolvedValue([
            { ...makeAgreementTemplate(), templateUrl: PUBLIC_MARKETING_URL },
        ]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(null); // not private

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const agreementDoc = result.myDocuments.find((d) => d.documentType === 'agreement_letter');
        // Not private -> falls through to the batched mask map, which leaves the
        // original url unchanged when no matching File row exists (mocked empty above).
        expect(agreementDoc?.fileUrl).toBe(PUBLIC_MARKETING_URL);
    });

    it('omits the url (fails closed) when a private file cannot be presigned', async () => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            makeApplication({ documents: [] }),
        );
        mockPrisma.documentTemplate.findMany.mockResolvedValue([
            { ...makeAgreementTemplate(), templateUrl: PRIVATE_TEMPLATE_URL },
        ]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(PRIVATE_FILE_UNAVAILABLE);

        const result = await handler.execute(new GetPortalDocumentsQuery(USER_ID));

        const agreementDoc = result.myDocuments.find((d) => d.documentType === 'agreement_letter');
        expect(agreementDoc?.fileUrl).toBeUndefined();
    });
});
