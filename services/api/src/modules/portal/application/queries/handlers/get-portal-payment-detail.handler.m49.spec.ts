// src/modules/portal/application/queries/handlers/get-portal-payment-detail.handler.m49.spec.ts
//
// Audit M49. resolvePendingTransactionContext() makes a cross-service HTTP
// call to the payment microservice for every invoice carrying a
// externalTransactionId, but its result is only ever read inside the
// 'processing' branches (pending history entry + pendingSubmission). For a
// paid/failed/unpaid invoice — the majority as invoice volume grows — this
// was a wasted network round trip on every cache miss.
//
// Also pins the TTL, which must stay SHORT for every status including paid:
// PaymentReconciliationService reverts settled invoices back to unpaid and
// holds no CacheService reference, so a long TTL on `paid` would show a
// participant "Paid" for up to a day after their payment was reverted.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GetPortalPaymentDetailHandler } from './get-portal-payment-detail.handler';
import { GetPortalPaymentDetailQuery } from '../portal-queries';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentServiceHttpClient } from '@modules/payments/infrastructure/services/payment-service-http.client';

describe('GetPortalPaymentDetailHandler pending-context call (audit M49)', () => {
    let handler: GetPortalPaymentDetailHandler;

    const mockPrisma = {
        applicationInvoice: { findUnique: jest.fn() },
        brandSetting: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const mockCacheService = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    const mockPortalCacheService = {
        getParticipantProfile: jest.fn().mockResolvedValue({ id: 'p-1', userId: 'u-1' }),
    };
    const mockPaymentClient = { get: jest.fn() };

    const buildInvoice = (status: string, overrides: Record<string, unknown> = {}) => ({
        id: 'inv-1',
        status,
        amount: 100,
        currency: 'USD',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        paidAt: status === 'paid' ? new Date('2026-09-01T00:00:00.000Z') : null,
        paymentMethod: 'manual_transfer',
        // Every invoice below carries a transaction id — this is the exact
        // condition the audit calls out ("every invoice with a transaction
        // id"), so the call is genuinely made-and-wasted, not skipped for an
        // unrelated reason.
        externalTransactionId: 'txn-1',
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
            validityPeriods: [],
        },
        ...overrides,
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetPortalPaymentDetailHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                // get() must return a string, not undefined: buildInternalHeaders()
                // calls .trim() on it unconditionally, and an undefined-throws-before-
                // the-fetch failure mode gets silently swallowed by
                // resolvePendingTransactionContext's own try/catch, which would make
                // "the call never happens" indistinguishable from "the call throws".
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
            ],
        }).compile();

        handler = module.get(GetPortalPaymentDetailHandler);
        jest.clearAllMocks();
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(undefined);
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'p-1', userId: 'u-1' });
        mockPaymentClient.get.mockResolvedValue({ data: {} });
    });

    it.each(['paid', 'failed', 'unpaid'])(
        'does NOT call the payment service for a %s invoice, even though it has a transaction id',
        async (status) => {
            mockPrisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice(status));

            await handler.execute(new GetPortalPaymentDetailQuery('u-1', 'inv-1'));

            expect(mockPaymentClient.get).not.toHaveBeenCalled();
        },
    );

    it('DOES call the payment service for a processing invoice, since the result is actually shown', async () => {
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice('processing'));

        await handler.execute(new GetPortalPaymentDetailQuery('u-1', 'inv-1'));

        expect(mockPaymentClient.get).toHaveBeenCalledTimes(1);
        expect(mockPaymentClient.get).toHaveBeenCalledWith('/api/v1/payments/txn-1', expect.anything());
    });

    it('caches a paid invoice with the SHORT ttl, because paid is NOT terminal in production', async () => {
        // PaymentReconciliationService reverts paid invoices back to unpaid
        // (its revertedUnpaid counter) and never invalidates this cache, so a
        // long TTL here would leave a participant looking at "Paid" for up to
        // a day after the revert. The saved round trip is not worth stale
        // money state.
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice('paid'));

        await handler.execute(new GetPortalPaymentDetailQuery('u-1', 'inv-1'));

        expect(mockCacheService.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.anything(),
            CACHE_TTL.SHORT,
        );
    });

    it('caches a processing invoice response with the short TTL, since it can still change', async () => {
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice('processing'));

        await handler.execute(new GetPortalPaymentDetailQuery('u-1', 'inv-1'));

        expect(mockCacheService.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.anything(),
            CACHE_TTL.SHORT,
        );
    });
});
