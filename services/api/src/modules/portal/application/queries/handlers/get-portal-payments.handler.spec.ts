import { Test, TestingModule } from '@nestjs/testing';
import { GetPortalPaymentsHandler } from './get-portal-payments.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalPaymentsQuery } from '../portal-queries';

describe('GetPortalPaymentsHandler', () => {
    let handler: GetPortalPaymentsHandler;

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
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalPaymentsHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
            ],
        }).compile();

        handler = module.get<GetPortalPaymentsHandler>(GetPortalPaymentsHandler);
    });

    afterEach(() => jest.clearAllMocks());

    // Active validity window around "now" so tiers are considered started.
    const activePeriod = () => [{
        startDate: new Date(Date.now() - 86_400_000),
        endDate: new Date(Date.now() + 86_400_000),
    }];

    const registrationTier = (overrides: Record<string, unknown>) => ({
        id: 'tier',
        name: 'Registration Fee',
        description: '',
        price: 0,
        currency: 'USD',
        usdPrice: 0,
        idrPrice: 0,
        feeType: 'registration_fee',
        allowedCategories: ['self_funded'],
        order: 1,
        isActive: true,
        deletedAt: null,
        validityPeriods: activePeriod(),
        ...overrides,
    });

    it('shows the fully_funded registration fee after a category switch cancelled the self_funded invoice', async () => {
        // Reproduces prod: participant registered self_funded (got a $15 SF invoice),
        // switched to fully_funded (SF invoice auto-cancelled). The fully_funded $10
        // tier must still be offered to pay — it was previously hidden because the
        // cancelled SF orphan (same feeType) broke the visibility loop.
        const sfTier = registrationTier({ id: 'sf', order: 1, allowedCategories: ['self_funded'], price: 15, usdPrice: 15, idrPrice: 263700 });
        const ffTier = registrationTier({ id: 'ff', order: 2, allowedCategories: ['fully_funded'], price: 10, usdPrice: 10, idrPrice: 175800 });

        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'participant-1' });
        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            applicationCategory: 'fully_funded',
            invoices: [{
                id: 'inv-cancelled-sf',
                amount: 15,
                currency: 'USD',
                amountUsd: 15,
                amountIdr: 263700,
                status: 'cancelled',
                paidAt: null,
                createdAt: new Date(Date.now() - 3_600_000),
                paymentMethod: null,
                pricingTierId: 'sf',
                exchangeRateSnapshot: null,
                pricingTier: { ...sfTier },
            }],
            program: {
                id: 'prog-1',
                currency: 'USD',
                usdInIdr: 17580,
                pricingTiers: [sfTier, ffTier],
            },
        });

        const result = await handler.execute(new GetPortalPaymentsQuery('user-1', undefined));

        const ffMethod = result.availableMethods.find((m) => m.id === 'ff');
        expect(ffMethod).toBeDefined();
        expect(ffMethod?.usdPrice).toBe(10);
        // The cancelled off-category SF invoice must not surface as a payable/outstanding item.
        expect(result.outstanding.some((o) => o.pricingTierId === 'sf')).toBe(false);
    });
});
