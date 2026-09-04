import { Test, TestingModule } from '@nestjs/testing';
import { GetPortalDashboardHandler } from './get-portal-dashboard.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalDashboardQuery } from '../portal-queries';

describe('GetPortalDashboardHandler', () => {
    let handler: GetPortalDashboardHandler;

    const mockPrisma = {
        participantApplication: {
            findFirst: jest.fn(),
        },
        file: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
    };

    const mockCacheService = {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(undefined),
    };

    const mockPortalCacheService = {
        getParticipantProfile: jest.fn(),
        getParticipantStats: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalDashboardHandler,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: CacheService,
                    useValue: mockCacheService,
                },
                {
                    provide: PortalCacheService,
                    useValue: mockPortalCacheService,
                },
            ],
        }).compile();

        handler = module.get<GetPortalDashboardHandler>(GetPortalDashboardHandler);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return onboarding dashboard if participant not found', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue(null);

        const result = await handler.execute(new GetPortalDashboardQuery('new-user'));
        
        expect(result.greeting).toBe('Welcome!');
        expect(result.alerts[0].id).toBe('onboarding-req');
        expect(result.stats?.totalRequired).toEqual({ amount: 0, currency: 'USD' });
    });

    it('should return full dashboard with application info', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User'
        });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 1,
            completedProgramsCount: 0,
            certificatesCount: 2,
        });

        // Mock Application with deep relations
        const mockApp = {
            id: 'app-1',
            status: 'draft',
            updatedAt: new Date(),
            applicationCategory: 'fully_funded',
            personalData: {
                full_name: 'Test User',
                nationality: 'Indonesia',
            },
            essayAnswers: {
                'essay-1': 'Answer',
            },
            uploadedFiles: {},
            program: {
                id: 'prog-1',
                name: 'YBB 2024',
                currency: 'USD',
                applicationDeadline: new Date(Date.now() + 86400000), // Tomorrow
                formFields: [
                    { section: 'personal_details', name: 'full_name', isRequired: true },
                    { section: 'contact_information', name: 'phone_number', isRequired: true },
                ],
                essays: [
                    { id: 'essay-1', isRequired: true },
                ],
                requirements: [
                    { id: 'doc-1', isRequired: true },
                ],
                pricingTiers: [],
                resources: [
                    { title: 'Eng', fileUrl: 'https://cdn.example.com/guide-en.pdf' },
                    { title: 'Ind', fileUrl: 'https://cdn.example.com/guide-id.pdf' },
                ],
                announcements: [],
                programAnnouncements: []
            },
            invoices: []
        };

        mockPrisma.participantApplication.findFirst.mockResolvedValue(mockApp);

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.greeting).toContain('Test');
        expect(result.activeApplication).toBeDefined();
        expect(result.activeApplication?.status).toBe('draft');
        expect(result.activeApplication?.progress).toBe(50);
        expect(result.activeApplication?.currentStep).toBe('Application Drafting');
        expect(result.activeApplication?.guidebooks).toEqual([
            { label: 'Read Guidebook (Eng)', url: 'https://cdn.example.com/guide-en.pdf' },
            { label: 'Read Guidebook (Ind)', url: 'https://cdn.example.com/guide-id.pdf' },
        ]);
        expect(result.stats?.applicationsCount).toBe(1);
        expect(result.stats?.certificatesCount).toBe(2);
        expect(result.stats?.totalRequired).toEqual({ amount: 0, currency: 'USD' });
    });

    it('should sum only unpaid and failed invoices for totalRequired', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User'
        });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 2,
            completedProgramsCount: 1,
            certificatesCount: 2,
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-2',
            status: 'submitted',
            updatedAt: new Date(),
            applicationCategory: 'self_funded',
            personalData: {},
            essayAnswers: {},
            uploadedFiles: {},
            program: {
                id: 'prog-2',
                name: 'YBB 2025',
                currency: 'IDR',
                applicationDeadline: new Date(Date.now() + 86400000),
                formFields: [],
                essays: [],
                requirements: [],
                pricingTiers: [],
                resources: [],
                announcements: [],
                programAnnouncements: [],
            },
            registrationPaymentStatus: 'unpaid',
            invoices: [
                { id: 'inv-1', status: 'paid', amount: 100 },
                { id: 'inv-2', status: 'unpaid', amount: 200 },
                { id: 'inv-3', status: 'failed', amount: 50.5 },
                { id: 'inv-4', status: 'processing', amount: 300 },
            ],
        });

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.stats?.totalRequired).toEqual({ amount: 250.5, currency: 'IDR' });
    });

    const buildAppWithRegTier = (
        options: {
            usdPrice?: number;
            validityPeriods?: { startDate: Date; endDate: Date }[];
            invoices?: Array<{ id: string; status: string; amount: number; pricingTier?: { feeType: string } }>;
            currency?: string;
            category?: string;
        } = {},
    ) => ({
        id: 'app-reg',
        status: 'draft',
        updatedAt: new Date(),
        applicationCategory: options.category ?? 'self_funded',
        personalData: {},
        essayAnswers: {},
        uploadedFiles: {},
        program: {
            id: 'prog-reg',
            name: 'MEYS',
            currency: options.currency ?? 'USD',
            applicationDeadline: new Date(Date.now() + 86400000),
            formFields: [],
            essays: [],
            requirements: [],
            pricingTiers: [
                {
                    id: 'reg-sf',
                    allowedCategories: ['self_funded'],
                    price: options.usdPrice ?? 15,
                    currency: 'USD',
                    usdPrice: options.usdPrice ?? 15,
                    idrPrice: 274500,
                    validityPeriods: options.validityPeriods ?? [
                        { startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000) },
                    ],
                },
            ],
            resources: [],
            announcements: [],
            programAnnouncements: [],
        },
        registrationPaymentStatus: 'unpaid',
        invoices: options.invoices ?? [],
    });

    const mockParticipantAndStats = () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'p-1', userId: 'u-1', fullName: 'Test User' });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 1,
            completedProgramsCount: 0,
            certificatesCount: 0,
        });
    };

    it('adds the registration fee to totalRequired when it is due but not yet invoiced', async () => {
        mockParticipantAndStats();
        mockPrisma.participantApplication.findFirst.mockResolvedValue(buildAppWithRegTier());

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.stats?.totalRequired).toEqual({ amount: 15, currency: 'USD' });
        expect(result.alerts.some((alert) => alert.id === 'payment-due')).toBe(true);
    });

    it('does not add the registration fee once it is already paid', async () => {
        mockParticipantAndStats();
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithRegTier({
                invoices: [{ id: 'inv-reg', status: 'paid', amount: 15, pricingTier: { feeType: 'registration_fee' } }],
            }),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.stats?.totalRequired).toEqual({ amount: 0, currency: 'USD' });
        expect(result.alerts.some((alert) => alert.id === 'payment-due')).toBe(false);
    });

    it('does not double-count an existing unpaid registration invoice', async () => {
        mockParticipantAndStats();
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithRegTier({
                invoices: [{ id: 'inv-reg', status: 'unpaid', amount: 15, pricingTier: { feeType: 'registration_fee' } }],
            }),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.stats?.totalRequired).toEqual({ amount: 15, currency: 'USD' });
    });

    it('does not add the registration fee before its window opens', async () => {
        mockParticipantAndStats();
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithRegTier({
                validityPeriods: [
                    { startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 2 * 86400000) },
                ],
            }),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.stats?.totalRequired).toEqual({ amount: 0, currency: 'USD' });
    });

    const buildAppWithFfTier = (
        validityPeriods: { startDate: Date; endDate: Date }[] | undefined,
    ) => ({
        id: 'app-ff',
        status: 'draft',
        updatedAt: new Date(),
        applicationCategory: 'self_funded',
        personalData: {},
        essayAnswers: {},
        uploadedFiles: {},
        program: {
            id: 'prog-ff',
            name: 'YBB FF',
            currency: 'USD',
            applicationDeadline: new Date(Date.now() + 86400000),
            formFields: [],
            essays: [],
            requirements: [],
            pricingTiers: [
                {
                    id: 'tier-sf',
                    allowedCategories: ['self_funded'],
                    validityPeriods: [],
                },
                {
                    id: 'tier-ff',
                    allowedCategories: ['fully_funded'],
                    validityPeriods,
                },
            ],
            resources: [],
            announcements: [],
            programAnnouncements: [],
        },
        registrationPaymentStatus: 'unpaid',
        invoices: [],
    });

    it('sets fullyFundedRegistrationClosed=true when all FF windows have ended', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User',
        });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 1,
            completedProgramsCount: 0,
            certificatesCount: 0,
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithFfTier([
                {
                    startDate: new Date(Date.now() - 2 * 86400000),
                    endDate: new Date(Date.now() - 86400000), // ended yesterday
                },
            ]),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.fullyFundedRegistrationClosed).toBe(true);
    });

    it('sets fullyFundedRegistrationClosed=false when an FF window is still active', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User',
        });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 1,
            completedProgramsCount: 0,
            certificatesCount: 0,
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithFfTier([
                {
                    startDate: new Date(Date.now() - 86400000),
                    endDate: new Date(Date.now() + 86400000), // ends tomorrow
                },
            ]),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.fullyFundedRegistrationClosed).toBe(false);
    });

    const buildAppWithBothWindows = (ffEnd: Date, sfEnd: Date) => {
        const app = buildAppWithFfTier([{ startDate: new Date(Date.now() - 10 * 86400000), endDate: ffEnd }]);
        app.program.pricingTiers[0].validityPeriods = [
            { startDate: new Date(Date.now() - 10 * 86400000), endDate: sfEnd },
        ];
        return app;
    };

    const primeCaches = () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'p-1', userId: 'u-1', fullName: 'Test User' });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 1,
            completedProgramsCount: 0,
            certificatesCount: 0,
        });
    };

    it('uses the FF window end as submissionDeadline while FF is still open', async () => {
        primeCaches();
        const ffEnd = new Date(Date.now() + 86400000);
        const sfEnd = new Date(Date.now() + 10 * 86400000);
        mockPrisma.participantApplication.findFirst.mockResolvedValue(buildAppWithBothWindows(ffEnd, sfEnd));

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(ffEnd.toISOString());
    });

    it('falls back to the SF window end once FF has closed', async () => {
        primeCaches();
        const ffEnd = new Date(Date.now() - 86400000);
        const sfEnd = new Date(Date.now() + 10 * 86400000);
        mockPrisma.participantApplication.findFirst.mockResolvedValue(buildAppWithBothWindows(ffEnd, sfEnd));

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(sfEnd.toISOString());
    });

    it('sets fullyFundedRegistrationClosed=false when the FF tier has no validity windows', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User',
        });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 1,
            completedProgramsCount: 0,
            certificatesCount: 0,
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithFfTier([]),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.fullyFundedRegistrationClosed).toBe(false);
    });
});

// Regression for the MEYS 6th/7th bug: this route used to build its query
// with no programId at all (unlike every sibling portal route), so a
// participant holding applications on two programs of the same brand always
// got whichever `currentApplicationWhere(participantId)` picked - which could
// contradict the top-bar program selector on the very same screen.
describe('GetPortalDashboardHandler - programId scoping', () => {
    let handler: GetPortalDashboardHandler;

    const mockPrisma = {
        participantApplication: { findFirst: jest.fn() },
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
    };

    const mockPortalCacheService = {
        getParticipantProfile: jest.fn().mockResolvedValue(null),
        getParticipantStats: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalDashboardHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
            ],
        }).compile();

        handler = module.get<GetPortalDashboardHandler>(GetPortalDashboardHandler);
        jest.clearAllMocks();
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(undefined);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue(null);
    });

    it('scopes currentApplicationWhere to the requested program', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User',
        });
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

        await handler.execute(new GetPortalDashboardQuery('u-1', 'program-a'));

        expect(mockPrisma.participantApplication.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ participantId: 'p-1', programId: 'program-a' }),
            }),
        );
    });

    it('does not scope the where clause when no programId is supplied (existing clients)', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User',
        });
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

        await handler.execute(new GetPortalDashboardQuery('u-1'));

        const where = mockPrisma.participantApplication.findFirst.mock.calls[0][0].where;
        expect(where).not.toHaveProperty('programId');
    });

    // The critical cache-poisoning check: two programs for the same user must
    // land in two DIFFERENT cache slots. Before this fix, PORTAL_DASHBOARD was
    // keyed by userId alone, so caching program A's response would then be
    // served back for program B until the 5-minute TTL expired.
    it('caches program A and program B under different keys, and each read consults its own key', async () => {
        // A real participant + no matching application still reaches the
        // `cacheService.set` call at the end of execute() (the "start your
        // journey" branch), unlike the onboarding short-circuit this describe
        // block otherwise defaults to.
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User',
        });
        mockPortalCacheService.getParticipantStats.mockResolvedValue({
            applicationsCount: 0,
            completedProgramsCount: 0,
            certificatesCount: 0,
        });
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

        await handler.execute(new GetPortalDashboardQuery('u-1', 'program-a'));
        await handler.execute(new GetPortalDashboardQuery('u-1', 'program-b'));
        await handler.execute(new GetPortalDashboardQuery('u-1'));

        const getKeys = mockCacheService.get.mock.calls.map((call) => call[0]);
        expect(getKeys).toEqual([
            CACHE_KEYS.PORTAL_DASHBOARD('u-1', 'program-a'),
            CACHE_KEYS.PORTAL_DASHBOARD('u-1', 'program-b'),
            CACHE_KEYS.PORTAL_DASHBOARD('u-1'),
        ]);
        // All three keys must be pairwise distinct - the actual failure mode
        // this guards against is two of these colliding on the same string.
        expect(new Set(getKeys).size).toBe(3);

        const setKeys = mockCacheService.set.mock.calls.map((call) => call[0]);
        expect(setKeys).toEqual(getKeys);
    });
});
