import { Test, TestingModule } from '@nestjs/testing';
import { GetPortalDashboardHandler } from './get-portal-dashboard.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetPortalDashboardQuery } from '../portal-queries';

describe('GetPortalDashboardHandler', () => {
    let handler: GetPortalDashboardHandler;
    let prisma: PrismaService;

    const mockPrisma = {
        participant: {
            findUnique: jest.fn(),
        },
        participantApplication: {
            findFirst: jest.fn(),
            count: jest.fn(),
        },
        participantDocument: {
            count: jest.fn(),
        }
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalDashboardHandler,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        handler = module.get<GetPortalDashboardHandler>(GetPortalDashboardHandler);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return onboarding dashboard if participant not found', async () => {
        mockPrisma.participant.findUnique.mockResolvedValue(null);

        const result = await handler.execute(new GetPortalDashboardQuery('new-user'));
        
        expect(result.greeting).toBe('Welcome!');
        expect(result.alerts[0].id).toBe('onboarding-req');
    });

    it('should return full dashboard with application info', async () => {
        mockPrisma.participant.findUnique.mockResolvedValue({
            id: 'p-1',
            userId: 'u-1',
            fullName: 'Test User'
        });

        // Mock Application with deep relations
        const mockApp = {
            id: 'app-1',
            status: 'draft',
            updatedAt: new Date(),
            applicationCategory: 'fully_funded',
            program: {
                name: 'YBB 2024',
                applicationDeadline: new Date(Date.now() + 86400000), // Tomorrow
                announcements: [],
                programAnnouncements: []
            },
            invoices: []
        };

        mockPrisma.participantApplication.findFirst.mockResolvedValue(mockApp);
        mockPrisma.participantApplication.count.mockResolvedValue(1);
        mockPrisma.participantDocument.count.mockResolvedValue(2);

        const result = await handler.execute(new GetPortalDashboardQuery('u-1'));

        expect(result.greeting).toContain('Test');
        expect(result.activeApplication).toBeDefined();
        expect(result.activeApplication?.status).toBe('draft');
        expect(result.stats?.applicationsCount).toBe(1);
        expect(result.stats?.certificatesCount).toBe(2);
    });
});
