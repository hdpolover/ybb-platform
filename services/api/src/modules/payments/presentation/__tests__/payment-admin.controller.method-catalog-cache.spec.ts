// services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.method-catalog-cache.spec.ts
//
// Audit M149: getPaymentMethodCatalog() (the private helper backing
// listInvoices/getInvoice's payment-method enrichment) hit the Go payment
// service uncached on every call, even though listMethods() (the public
// GET /methods admin endpoint) and the per-program overlay both cache the
// identical /api/v1/payment-methods fetch under CACHE_KEYS.PAYMENT_METHODS /
// CACHE_TTL.MEDIUM. Fix: getPaymentMethodCatalog now shares that same cache
// key/TTL for the no-filter call.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';

describe('PaymentAdminController — payment method catalog cache (audit M149)', () => {
    let controller: PaymentAdminController;
    let paymentClientGet: jest.Mock;

    const invoiceRow = {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'paid',
        paymentMethod: null as string | null,
        // Deliberately null: getInvoice would otherwise make additional
        // paymentServiceClient.get calls to resolve the transaction, which
        // would pollute the call count this spec is asserting on.
        externalIntentId: null as string | null,
        externalTransactionId: null as string | null,
        pricingTier: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        application: { participant: { user: {} } },
    };

    const PAYMENT_METHODS_PAYLOAD = {
        data: [
            { code: 'bank_transfer', display_name: 'Bank Transfer' },
            { code: 'gopay', display_name: 'GoPay' },
        ],
    };

    beforeEach(async () => {
        // Real in-memory cache backing, not a stub — the point of these
        // specs is to prove the SECOND call is actually served from cache.
        const store = new Map<string, unknown>();
        const mockCacheService = {
            get: jest.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
            set: jest.fn(async (key: string, value: unknown) => {
                store.set(key, value);
            }),
        };

        paymentClientGet = jest.fn(async (url: string) => {
            if (url === '/api/v1/payment-methods') {
                return { data: PAYMENT_METHODS_PAYLOAD };
            }
            throw new Error(`unexpected paymentServiceClient.get(${url})`);
        });

        const mockPrisma = {
            applicationInvoice: { findUnique: jest.fn().mockResolvedValue(invoiceRow) },
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: { get: paymentClientGet, post: jest.fn() } },
                { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn() } },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: PrismaReadService, useValue: mockPrisma },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<PaymentAdminController>(PaymentAdminController);
    });

    it('fetches the catalog once upstream and serves the second getInvoice call from cache', async () => {
        await controller.getInvoice(invoiceRow.id);
        await controller.getInvoice(invoiceRow.id);

        const catalogCalls = paymentClientGet.mock.calls.filter(
            ([url]) => url === '/api/v1/payment-methods',
        );
        expect(catalogCalls).toHaveLength(1);
    });

    it('shares the cache entry warmed by listMethods() — getInvoice makes no further upstream call', async () => {
        await controller.listMethods({});
        expect(paymentClientGet).toHaveBeenCalledTimes(1);

        await controller.getInvoice(invoiceRow.id);

        // Still just the one call from listMethods — getPaymentMethodCatalog
        // read the same cache key listMethods warmed, so it never re-fetches.
        expect(paymentClientGet).toHaveBeenCalledTimes(1);
    });
});
