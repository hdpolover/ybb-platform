
import { Test, TestingModule } from '@nestjs/testing';
import { GetAmbassadorDashboardHandler } from './get-ambassador-dashboard.handler';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAmbassadorDashboardQuery } from '../get-ambassador-dashboard.query';
import { NotFoundException } from '@nestjs/common';
import { parseAmbassadorShareToken } from '../../utils/ambassador-share-token.util';

describe('GetAmbassadorDashboardHandler', () => {
    let handler: GetAmbassadorDashboardHandler;
    let prismaService: any;
    const previousJwtSecret = process.env.JWT_SECRET;

    const mockPrismaService = {
        ambassador: {
            findUnique: jest.fn(),
        },
    };

    const mockAmbassadorRepo = {}; // Helper if needed, but handler uses Prisma directly now

    beforeAll(() => {
        process.env.JWT_SECRET = 'test-secret-for-ambassador-share-token';
    });

    afterAll(() => {
        process.env.JWT_SECRET = previousJwtSecret;
    });

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
        const ambassadorId = '11111111-1111-4111-8111-111111111111';

        mockPrismaService.ambassador.findUnique.mockResolvedValue({
            id: ambassadorId,
            userId: 'user-1',
            referralCode: 'REF123',
            totalReferrals: 5,
            successfulReferrals: 1,
            isActive: true,
            referrals: [
                {
                    id: 'ref-1',
                    status: 'accepted',
                    referredAt: new Date('2026-01-02T00:00:00.000Z'),
                    registeredAt: new Date('2026-01-05T00:00:00.000Z'),
                    appliedAt: new Date('2026-01-08T00:00:00.000Z'),
                    acceptedAt: new Date('2026-01-10T00:00:00.000Z'),
                    completedAt: null,
                    daysToRegister: 3,
                    daysToApply: 6,
                    daysToAccept: 8,
                    totalConversionDays: null,
                    participant: {
                        id: 'participant-1',
                        fullName: 'Alya Putri',
                    },
                },
            ],
            program: {
                name: 'YBB Ambassador 2025',
                slug: 'ybb-ambassador-2025',
                brand: {
                    websiteUrl: 'https://youthbreaktheboundaries.com'
                }
            }
        });

        const result = await handler.execute(query);

        expect(result.id).toBe(ambassadorId);
        expect(result.referralCode).toBe('REF123');
        const shareUrl = new URL(result.shareLink ?? '');
        expect(shareUrl.origin).toBe('https://youthbreaktheboundaries.com');
        expect(shareUrl.pathname).toBe('/programs/ybb-ambassador-2025');
        expect(shareUrl.searchParams.get('r')).toBeTruthy();
        expect(parseAmbassadorShareToken(shareUrl.searchParams.get('r')!)).toBe(ambassadorId);
        expect(result.programName).toBe('YBB Ambassador 2025');
        expect(result.referrals).toEqual([
            expect.objectContaining({
                id: 'ref-1',
                participantId: 'participant-1',
                participantName: 'Alya Putri',
                status: 'accepted',
                daysToAccept: 8,
            }),
        ]);
    });

    it('should handle brand URL without protocol', async () => {
        const query = new GetAmbassadorDashboardQuery('user-2');
        const ambassadorId = '22222222-2222-4222-8222-222222222222';

        mockPrismaService.ambassador.findUnique.mockResolvedValue({
            id: ambassadorId,
            referralCode: 'REF456',
            referrals: [],
            program: {
                slug: 'iys-2025',
                brand: {
                    websiteUrl: 'istanbulyouthsummit.com' // No https://
                }
            }
        });

        const result = await handler.execute(query);
        const shareUrl = new URL(result.shareLink ?? '');
        expect(shareUrl.origin).toBe('https://istanbulyouthsummit.com');
        expect(shareUrl.pathname).toBe('/programs/iys-2025');
        expect(parseAmbassadorShareToken(shareUrl.searchParams.get('r')!)).toBe(ambassadorId);
    });

    it('should throw NotFoundException if ambassador not found', async () => {
        const query = new GetAmbassadorDashboardQuery('unknown-user');
        mockPrismaService.ambassador.findUnique.mockResolvedValue(null);

        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
    });
});
