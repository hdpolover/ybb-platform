// services/api/src/modules/portal/application/queries/handlers/get-portal-payment-detail.handler.spec.ts
//
// Audit M66. This handler hand-rolled resolveTierPeriod's three-step ladder
// (period containing the invoice date -> first period not yet ended -> last
// configured period) with raw interval comparisons, making it a FOURTH copy of
// a rule tier-period.util.ts exists to own. The payments LIST handler already
// resolved the same invoice's due date through the shared helper, so the two
// screens could show different due dates for the same invoice on the same day.
//
// The file had no spec at all before this.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GetPortalPaymentDetailHandler } from './get-portal-payment-detail.handler';
import { GetPortalPaymentDetailQuery } from '../portal-queries';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentServiceHttpClient } from '@modules/payments/infrastructure/services/payment-service-http.client';

// Admins pick whole calendar days, so a period end is stored at 00:00 UTC,
// which is 07:00 WIB on that same day. The shared rule runs it through to
// 23:59:59.999 WIB.
const WINDOW_START = new Date('2026-09-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-09-05T00:00:00.000Z');
const LATER_WINDOW_START = new Date('2026-09-06T00:00:00.000Z');
const LATER_WINDOW_END = new Date('2026-09-10T00:00:00.000Z');

describe('GetPortalPaymentDetailHandler due date (audit M66)', () => {
    let handler: GetPortalPaymentDetailHandler;

    const mockPrisma = {
        applicationInvoice: { findUnique: jest.fn() },
        brandSetting: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const mockCacheService = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    const mockPortalCacheService = {
        getParticipantProfile: jest.fn().mockResolvedValue({ id: 'p-1', userId: 'u-1' }),
    };
    const mockPaymentClient = { getTransactionStatus: jest.fn().mockResolvedValue(null) };

    const buildInvoice = (
        validityPeriods: { startDate: Date; endDate: Date }[],
        createdAt: Date,
    ) => ({
        id: 'inv-1',
        status: 'unpaid',
        amount: 100,
        currency: 'USD',
        createdAt,
        updatedAt: createdAt,
        paidAt: null,
        paymentMethod: null,
        externalTransactionId: null,
        exchangeRateSnapshot: null,
        amountUsd: null,
        amountIdr: null,
        application: {
            participantId: 'p-1',
            program: { usdInIdr: 16000, brandId: 'b-1', paymentInfoHtml: null },
        },
        pricingTier: {
            name: 'Registration',
            feeType: 'registration_fee',
            price: 100,
            currency: 'USD',
            usdPrice: 100,
            idrPrice: null,
            validityPeriods,
        },
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalPaymentDetailHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: ConfigService, useValue: { get: jest.fn() } },
            ],
        }).compile();

        handler = module.get(GetPortalPaymentDetailHandler);
        mockCacheService.get.mockResolvedValue(null);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'p-1', userId: 'u-1' });
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    const run = async (systemTime: string, periods: { startDate: Date; endDate: Date }[], createdAt: Date) => {
        jest.useFakeTimers().setSystemTime(new Date(systemTime));
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice(periods, createdAt));
        return handler.execute(new GetPortalPaymentDetailQuery('u-1', 'inv-1'));
    };

    it('keeps the window containing the invoice date as the due date late on that window last WIB day', async () => {
        // 12:00 WIB on 5 Sep: past the raw stored instant, still inside the WIB
        // day. The old raw `endDate >= invoice.createdAt` ladder is not what
        // breaks here - it is that a window ending "today" must still count as
        // the one containing an invoice raised inside it.
        const result = await run(
            '2026-09-05T05:00:00.000Z',
            [{ startDate: WINDOW_START, endDate: WINDOW_END }],
            new Date('2026-09-03T00:00:00.000Z'),
        );

        expect(result.invoice.dueDate).toBe(WINDOW_END.toISOString());
    });

    it('does not skip to the next window until the current one has really ended in WIB', async () => {
        // The discriminating case. Invoice raised at 07:30 WIB on 5 Sep - AFTER
        // the raw stored end instant of the window it actually belongs to. The
        // raw ladder finds no containing window, falls through to "first period
        // that has not ended", and hands back the NEXT window's end - showing
        // the participant a due date five days too late.
        const result = await run(
            '2026-09-05T05:00:00.000Z',
            [
                { startDate: WINDOW_START, endDate: WINDOW_END },
                { startDate: LATER_WINDOW_START, endDate: LATER_WINDOW_END },
            ],
            new Date('2026-09-05T00:30:00.000Z'),
        );

        expect(result.invoice.dueDate).toBe(WINDOW_END.toISOString());
    });

    it('falls through to the next window once the invoice date is genuinely past the WIB end', async () => {
        // Guard against over-widening: at 00:30 WIB on 6 Sep the first window
        // really is over, so the ladder must move on rather than pin a stale end.
        const result = await run(
            '2026-09-05T17:30:00.000Z',
            [
                { startDate: WINDOW_START, endDate: WINDOW_END },
                { startDate: LATER_WINDOW_START, endDate: LATER_WINDOW_END },
            ],
            new Date('2026-09-05T17:30:00.000Z'),
        );

        expect(result.invoice.dueDate).toBe(LATER_WINDOW_END.toISOString());
    });

    it('reports no due date when the tier has no validity periods at all', async () => {
        const result = await run('2026-09-05T05:00:00.000Z', [], new Date('2026-09-03T00:00:00.000Z'));

        expect(result.invoice.dueDate).toBeUndefined();
    });
});
