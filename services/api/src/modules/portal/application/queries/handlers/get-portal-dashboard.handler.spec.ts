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

    // ---- submissionDeadline: scoped to the application's OWN category ----
    // The old rule preferred the Fully Funded window globally while it was
    // open, which showed self-funded applicants an FF deadline months early,
    // and showed every FF applicant the SF date once FF closed.

    const buildAppWithBothWindows = (
        ffEnd: Date,
        sfEnd: Date,
        applicationCategory: string | null = 'self_funded',
    ) => {
        const app = buildAppWithFfTier([{ startDate: new Date(Date.now() - 10 * 86400000), endDate: ffEnd }]);
        app.program.pricingTiers[0].validityPeriods = [
            { startDate: new Date(Date.now() - 10 * 86400000), endDate: sfEnd },
        ];
        (app as { applicationCategory: string | null }).applicationCategory = applicationCategory;
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

    it('uses the self funded window for a self funded application even while the FF window is open', async () => {
        primeCaches();
        const ffEnd = new Date(Date.now() + 86400000);
        const sfEnd = new Date(Date.now() + 10 * 86400000);
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithBothWindows(ffEnd, sfEnd, 'self_funded'),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(sfEnd.toISOString());
    });

    it('uses the fully funded window for a fully funded application even though the SF window runs later', async () => {
        primeCaches();
        const ffEnd = new Date(Date.now() + 86400000);
        const sfEnd = new Date(Date.now() + 10 * 86400000);
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithBothWindows(ffEnd, sfEnd, 'fully_funded'),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(ffEnd.toISOString());
    });

    it('keeps the self funded deadline for self funded applicants after the FF window has closed', async () => {
        primeCaches();
        const ffEnd = new Date(Date.now() - 86400000);
        const sfEnd = new Date(Date.now() + 10 * 86400000);
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithBothWindows(ffEnd, sfEnd, 'self_funded'),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(sfEnd.toISOString());
    });

    it('falls back to the program applicationDeadline (not the still-open SF window) when the FF window has ended', async () => {
        primeCaches();
        const ffEnd = new Date(Date.now() - 86400000);
        const sfEnd = new Date(Date.now() + 10 * 86400000);
        const app = buildAppWithBothWindows(ffEnd, sfEnd, 'fully_funded');
        const programDeadline = new Date(Date.now() + 20 * 86400000);
        app.program.applicationDeadline = programDeadline;
        mockPrisma.participantApplication.findFirst.mockResolvedValue(app);

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        // Fallback is always the program's own applicationDeadline, never
        // another category's window - a Fully Funded applicant whose window
        // closed must not inherit the Self Funded date.
        expect(result.activeApplication?.submissionDeadline).toBe(programDeadline.toISOString());
    });

    // ---- submissionDeadline: staged ("bertahap") main + extension windows ----
    // The owner runs a MAIN registration window followed by short extension
    // windows on purpose, to create urgency at each step. Showing the MAX
    // end across all of them (the pre-fix behaviour) would publish the whole
    // extension ladder months in advance. The fix: show only the window that
    // is currently ACTIVE (start <= now < end) for the application's own
    // category.

    const buildAppWithStagedWindows = (
        periods: { startDate: Date; endDate: Date }[],
        category: string | null = 'self_funded',
        programDeadline: Date = new Date(Date.now() + 86400000),
    ) => {
        const app = buildAppWithFfTier([]);
        if (category === 'fully_funded') {
            app.program.pricingTiers[1].validityPeriods = periods;
        } else {
            app.program.pricingTiers[0].validityPeriods = periods;
        }
        (app as { applicationCategory: string | null }).applicationCategory = category;
        app.program.applicationDeadline = programDeadline;
        return app;
    };

    it('shows the active main window end, not the max across future extension windows', async () => {
        primeCaches();
        const mainEnd = new Date(Date.now() + 5 * 86400000);
        const periods = [
            { startDate: new Date(Date.now() - 2 * 86400000), endDate: mainEnd }, // active main window
            { startDate: mainEnd, endDate: new Date(Date.now() + 6 * 86400000) }, // future extension 1
            { startDate: new Date(Date.now() + 6 * 86400000), endDate: new Date(Date.now() + 7 * 86400000) }, // future extension 2 - the old MAX
        ];
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithStagedWindows(periods, 'self_funded'),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(mainEnd.toISOString());
    });

    it('moves the shown deadline to the extension end once that extension window becomes active', async () => {
        primeCaches();
        const extEnd = new Date(Date.now() + 86400000);
        const periods = [
            { startDate: new Date(Date.now() - 10 * 86400000), endDate: new Date(Date.now() - 5 * 86400000) }, // main window, already elapsed
            { startDate: new Date(Date.now() - 5 * 86400000), endDate: extEnd }, // extension now in effect
            { startDate: extEnd, endDate: new Date(Date.now() + 8 * 86400000) }, // next extension, not yet active
        ];
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithStagedWindows(periods, 'fully_funded'),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(extEnd.toISOString());
    });

    it('takes the later end when two active windows for the category overlap', async () => {
        primeCaches();
        const laterEnd = new Date(Date.now() + 5 * 86400000);
        const periods = [
            { startDate: new Date(Date.now() - 5 * 86400000), endDate: laterEnd },
            { startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 2 * 86400000) },
        ];
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithStagedWindows(periods, 'self_funded'),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(laterEnd.toISOString());
    });

    it('falls back to the program applicationDeadline once every staged window for the category has expired', async () => {
        primeCaches();
        const programDeadline = new Date(Date.now() + 30 * 86400000);
        const periods = [
            { startDate: new Date(Date.now() - 20 * 86400000), endDate: new Date(Date.now() - 10 * 86400000) },
            { startDate: new Date(Date.now() - 10 * 86400000), endDate: new Date(Date.now() - 86400000) },
        ];
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithStagedWindows(periods, 'fully_funded', programDeadline),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        // Extension ladder exhausted -> revert to the default guideline
        // timing, don't go silent and don't keep implying more extensions.
        expect(result.activeApplication?.submissionDeadline).toBe(programDeadline.toISOString());
    });

    it('falls back to the program applicationDeadline when now sits in a gap between two staged windows', async () => {
        primeCaches();
        const programDeadline = new Date(Date.now() + 30 * 86400000);
        const periods = [
            { startDate: new Date(Date.now() - 10 * 86400000), endDate: new Date(Date.now() - 3 * 86400000) }, // ended
            { startDate: new Date(Date.now() + 3 * 86400000), endDate: new Date(Date.now() + 4 * 86400000) }, // not yet started
        ];
        mockPrisma.participantApplication.findFirst.mockResolvedValue(
            buildAppWithStagedWindows(periods, 'self_funded', programDeadline),
        );

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(programDeadline.toISOString());
    });

    it('falls back to the program applicationDeadline when the application has no category', async () => {
        primeCaches();
        const ffEnd = new Date(Date.now() + 86400000);
        const sfEnd = new Date(Date.now() + 10 * 86400000);
        const app = buildAppWithBothWindows(ffEnd, sfEnd, null);
        const programDeadline = new Date(Date.now() + 30 * 86400000);
        app.program.applicationDeadline = programDeadline;
        mockPrisma.participantApplication.findFirst.mockResolvedValue(app);

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(programDeadline.toISOString());
    });

    it('falls back to the program applicationDeadline when the category has no configured window', async () => {
        primeCaches();
        // Only an FF tier carries a window; the self funded tier has none.
        const app = buildAppWithFfTier([
            { startDate: new Date(Date.now() - 10 * 86400000), endDate: new Date(Date.now() + 86400000) },
        ]);
        const programDeadline = new Date(Date.now() + 30 * 86400000);
        app.program.applicationDeadline = programDeadline;
        mockPrisma.participantApplication.findFirst.mockResolvedValue(app);

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBe(programDeadline.toISOString());
    });

    it('omits submissionDeadline when the fallback program applicationDeadline is already past', async () => {
        primeCaches();
        const app = buildAppWithFfTier([]);
        app.program.applicationDeadline = new Date(Date.now() - 5 * 86400000);
        mockPrisma.participantApplication.findFirst.mockResolvedValue(app);

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.activeApplication?.submissionDeadline).toBeUndefined();
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
    // ---- M66: the WIB day boundary, asserted AT the boundary ----
    // Admins pick whole calendar days, so a validity window's endDate is
    // usually stored at 00:00 UTC, which is 07:00 WIB on that same day. Under
    // the old raw `endDate < now` the window died at 07:00 WIB and the
    // participant was told Fully Funded registration had closed for the
    // remaining ~17 hours of the day it was actually still open.
    //
    // Every other test in this file uses a full day of margin, which reads the
    // same whether the comparison is raw or WIB-aware. These do not.
    const WINDOW_END_UTC_MIDNIGHT = new Date('2026-09-05T00:00:00.000Z'); // 07:00 WIB, 5 Sep
    const WINDOW_START = new Date('2026-09-01T00:00:00.000Z');

    const runDashboardAt = async (
        systemTime: string,
        validityPeriods: { startDate: Date; endDate: Date }[],
        applicationCategory?: string,
    ) => {
        jest.useFakeTimers().setSystemTime(new Date(systemTime));
        try {
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
            const app = buildAppWithFfTier(validityPeriods);
            if (applicationCategory) app.applicationCategory = applicationCategory;
            mockPrisma.participantApplication.findFirst.mockResolvedValue(app);
            return await handler.execute(new GetPortalDashboardQuery('u-1'));
        } finally {
            jest.useRealTimers();
        }
    };

    it('keeps a Fully Funded window open through WIB end-of-day on the day it ends', async () => {
        // 12:00 WIB on 5 Sep - five hours PAST the raw stored instant, and the
        // whole point of the bug. A raw endDate < now says closed here.
        const result = await runDashboardAt('2026-09-05T05:00:00.000Z', [
            { startDate: WINDOW_START, endDate: WINDOW_END_UTC_MIDNIGHT },
        ]);

        expect(result.activeApplication?.fullyFundedRegistrationClosed).toBe(false);
    });

    it('closes a Fully Funded window once WIB end-of-day has passed', async () => {
        // 00:30 WIB on 6 Sep - the first half hour after the window really ends.
        const result = await runDashboardAt('2026-09-05T17:30:00.000Z', [
            { startDate: WINDOW_START, endDate: WINDOW_END_UTC_MIDNIGHT },
        ]);

        expect(result.activeApplication?.fullyFundedRegistrationClosed).toBe(true);
    });

    it('still reports the active window as the submission deadline late on its final WIB day', async () => {
        // Same instant as the first case, read through the OTHER consumer of
        // the same rule (activeCategoryWindowEnd). The window lives on the
        // fully-funded tier, so the application has to be fully-funded for it
        // to be its own category's window - the deadline is deliberately
        // category-scoped. Under the raw rule the window is not active at
        // 12:00 WIB, so this falls through to the programme deadline instead.
        const result = await runDashboardAt(
            '2026-09-05T05:00:00.000Z',
            [{ startDate: WINDOW_START, endDate: WINDOW_END_UTC_MIDNIGHT }],
            'fully_funded',
        );

        expect(result.activeApplication?.submissionDeadline).toBe(
            WINDOW_END_UTC_MIDNIGHT.toISOString(),
        );
    });

    it('counts the deadline day itself as a day remaining, not zero', async () => {
        // buildAppWithFfTier pins applicationDeadline to now + 1 day, so drive
        // this one through a window-free application instead: at 12:00 WIB on
        // the deadline's own WIB day there are still ~12 hours to submit, and
        // the old raw diff reported 0.
        jest.useFakeTimers().setSystemTime(new Date('2026-09-05T05:00:00.000Z'));
        try {
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
            const app = buildAppWithFfTier([]);
            app.applicationCategory = null as unknown as string;
            app.program.applicationDeadline = new Date('2026-09-05T00:00:00.000Z');
            mockPrisma.participantApplication.findFirst.mockResolvedValue(app);

            const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

            expect(result.activeApplication?.daysUntilDeadline).toBe(1);
        } finally {
            jest.useRealTimers();
        }
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
