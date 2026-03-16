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
        expect(result.activeApplication?.progress).toBe(60);
        expect(result.activeApplication?.currentStep).toBe('Application Drafting');
        expect(result.stats?.applicationsCount).toBe(1);
        expect(result.stats?.certificatesCount).toBe(2);
    });
});
