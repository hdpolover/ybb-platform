
import { Test, TestingModule } from '@nestjs/testing';
import { GetAmbassadorDashboardHandler } from './get-ambassador-dashboard.handler';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAmbassadorDashboardQuery } from '../get-ambassador-dashboard.query';
import { NotFoundException } from '@nestjs/common';

describe('GetAmbassadorDashboardHandler', () => {
    let handler: GetAmbassadorDashboardHandler;
    let prismaService: any;

    const mockPrismaService = {
        ambassador: {
            findUnique: jest.fn(),
        },
    };

    const mockAmbassadorRepo = {}; // Helper if needed, but handler uses Prisma directly now

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetAmbassadorDashboardHandler,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: 'IAmbassadorRepository', useValue: mockAmbassadorRepo }, // Dependency injection filler
            ],
        }).compile();

        handler = module.get<GetAmbassadorDashboardHandler>(GetAmbassadorDashboardHandler);
        prismaService = module.get<PrismaService>(PrismaService);
        
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should return dashboard data with correct shareLink', async () => {
        const query = new GetAmbassadorDashboardQuery('user-1');

        mockPrismaService.ambassador.findUnique.mockResolvedValue({
            id: 'amb-1',
            userId: 'user-1',
            referralCode: 'REF123',
            totalReferrals: 5,
            successfulReferrals: 1,
            isActive: true,
            program: {
                name: 'YBB Ambassador 2025',
                slug: 'ybb-ambassador-2025',
                brand: {
                    websiteUrl: 'https://youthbreaktheboundaries.com'
                }
            }
        });

        const result = await handler.execute(query);

        expect(result.id).toBe('amb-1');
        expect(result.referralCode).toBe('REF123');
        // Check URL construction
        expect(result.shareLink).toBe('https://youthbreaktheboundaries.com/programs/ybb-ambassador-2025?t=REF123');
        expect(result.programName).toBe('YBB Ambassador 2025');
    });

    it('should handle brand URL without protocol', async () => {
        const query = new GetAmbassadorDashboardQuery('user-2');

        mockPrismaService.ambassador.findUnique.mockResolvedValue({
            id: 'amb-2',
            referralCode: 'REF456',
            program: {
                slug: 'iys-2025',
                brand: {
                    websiteUrl: 'istanbulyouthsummit.com' // No https://
                }
            }
        });

        const result = await handler.execute(query);
        expect(result.shareLink).toBe('https://istanbulyouthsummit.com/programs/iys-2025?t=REF456');
    });

    it('should throw NotFoundException if ambassador not found', async () => {
        const query = new GetAmbassadorDashboardQuery('unknown-user');
        mockPrismaService.ambassador.findUnique.mockResolvedValue(null);

        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
    });
});
