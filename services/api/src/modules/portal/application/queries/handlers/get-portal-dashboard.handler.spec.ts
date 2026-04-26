import { Test, TestingModule } from '@nestjs/testing';
import { GetPortalDashboardHandler } from './get-portal-dashboard.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalDashboardQuery } from '../portal-queries';

describe('GetPortalDashboardHandler', () => {
    let handler: GetPortalDashboardHandler;

    const mockPrisma = {
        participantApplication: {
            findFirst: jest.fn(),
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
});
