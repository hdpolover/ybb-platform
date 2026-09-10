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

    // Audit M60: totalPaid/totalDue used to do `+= Number(invoice.amount)` with
    // no regard for invoice.currency, so a USD invoice and an IDR invoice on the
    // same application got summed into one meaningless number labelled with the
    // programme's currency (dual-currency programmes commonly mix gateway-USD
    // and manual-transfer-IDR invoices - see module CLAUDE.md).
    it('sums totalPaid in the programme currency instead of blindly adding raw invoice.amount across currencies', async () => {
        const regTier = registrationTier({
            id: 'reg', order: 1, feeType: 'registration_fee', allowedCategories: [],
            usdPrice: 10, idrPrice: 175800,
        });
        const progFeeTier = registrationTier({
            id: 'prog-fee', order: 2, feeType: 'program_fee_1', allowedCategories: [],
            usdPrice: 10, idrPrice: 175800,
        });

        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'participant-1' });
        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            applicationCategory: 'self_funded',
            invoices: [
                {
                    // Gateway invoice: USD, with its own USD/IDR snapshot.
                    id: 'inv-usd',
                    amount: 10,
                    currency: 'USD',
                    amountUsd: 10,
                    amountIdr: 175800,
                    status: 'paid',
                    paidAt: new Date(),
                    createdAt: new Date(Date.now() - 7_200_000),
                    paymentMethod: 'credit_card',
                    pricingTierId: 'reg',
                    exchangeRateSnapshot: 17580,
                    pricingTier: { ...regTier },
                },
                {
                    // Manual-transfer invoice: settled in IDR, no dual-price snapshot on
                    // this row (legacy shape) - amount is a raw IDR figure that must NOT
                    // be added directly to a USD-denominated total.
                    id: 'inv-idr',
                    amount: 175800,
                    currency: 'IDR',
                    amountUsd: null,
                    amountIdr: null,
                    status: 'paid',
                    paidAt: new Date(),
                    createdAt: new Date(Date.now() - 3_600_000),
                    paymentMethod: 'bank_transfer',
                    pricingTierId: 'prog-fee',
                    exchangeRateSnapshot: 17580,
                    pricingTier: { ...progFeeTier },
                },
            ],
            program: {
                id: 'prog-1',
                currency: 'USD',
                usdInIdr: 17580,
                pricingTiers: [regTier, progFeeTier],
            },
        });

        const result = await handler.execute(new GetPortalPaymentsQuery('user-1', undefined));

        // Both invoices are worth $10 USD (the IDR one converts back via the
        // 17580 rate: 175800 / 17580 = 10). The old code would have produced
        // 10 + 175800 = 175810.
        expect(result.stats.currency).toBe('USD');
        expect(result.stats.totalPaid).toBe(20);
    });

    // Same currency-mixing bug, uninvoiced branch: `tier.price`/`tier.currency`
    // are legacy single-currency fields that can disagree with the programme's
    // display currency.
    it('sums totalDue for available (uninvoiced) tiers using the dual-price field matching the programme currency', async () => {
        const tier = registrationTier({
            id: 'ff-avail',
            order: 1,
            feeType: 'registration_fee',
            allowedCategories: [],
            price: 10,          // legacy USD figure
            currency: 'USD',
            usdPrice: 10,
            idrPrice: 175800,   // correct IDR figure for an IDR-denominated programme
        });

        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'participant-1' });
        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            applicationCategory: 'self_funded',
            invoices: [],
            program: {
                id: 'prog-1',
                currency: 'IDR',
                usdInIdr: 17580,
                pricingTiers: [tier],
            },
        });

        const result = await handler.execute(new GetPortalPaymentsQuery('user-1', undefined));

        // The old code did `totalDue += Number(tier.price)` = 10 (a USD amount
        // silently labelled IDR). It must use the IDR dual-price instead.
        expect(result.stats.currency).toBe('IDR');
        expect(result.stats.totalDue).toBe(175800);
    });
});
