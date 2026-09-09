// src/modules/payments/presentation/__tests__/payment-admin.controller.notify-payment-issue.spec.ts
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
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

const MOCK_ADMIN_USER: CurrentUserData = {
    userId: 'admin-1',
    email: 'admin@test.com',
    brandId: 'brand-1',
    role: [],
    adminId: 'admin-id-1',
};

function makeInvoice(id: string) {
    return {
        id,
        applicationId: `app-${id}`,
        amount: 1500000,
        currency: 'IDR',
        pricingTier: { feeType: 'program' },
        application: {
            id: `app-${id}`,
            participant: {
                fullName: `Participant ${id}`,
                userId: `user-${id}`,
                user: { email: `${id}@example.com` },
            },
            program: {
                id: 'program-1',
                name: 'YBB Program',
                contactEmail: 'info@example.com',
                contactAddress: '123 Test St',
                brand: {
                    id: 'brand-1',
                    name: 'Test Brand',
                    primaryColor: '#FF5500',
                    logoUrl: 'https://example.com/logo.png',
                    websiteUrl: 'https://example.com',
                    landingUrl: 'https://example.com',
                    socialMediaLinks: null,
                    settings: null,
                },
            },
        },
    };
}

describe('PaymentAdminController — notifyPaymentIssue (M154)', () => {
    let controller: PaymentAdminController;
    let rabbitmqProducer: jest.Mocked<RabbitMQProducerService>;
    let prisma: { applicationInvoice: { findMany: jest.Mock } };

    async function buildController() {
        const mockRabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };
        const mockPrisma = { applicationInvoice: { findMany: jest.fn() } };
        const mockConfig = { get: jest.fn().mockReturnValue('') };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: { post: jest.fn() } },
                { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn() } },
                { provide: ConfigService, useValue: mockConfig },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: { invalidateInvoiceCache: jest.fn() } },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: PrismaReadService, useValue: mockPrisma },
                { provide: RabbitMQProducerService, useValue: mockRabbitmq },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<PaymentAdminController>(PaymentAdminController);
        rabbitmqProducer = module.get(RabbitMQProducerService);
        prisma = module.get(PrismaService);
    }

    beforeEach(async () => {
        await buildController();
    });

    it('publishes one payment.issue_alternative event per known invoice and reports sent/skipped', async () => {
        const invoiceIds = ['1', '2', '3'];
        prisma.applicationInvoice.findMany.mockResolvedValue(invoiceIds.map(makeInvoice));

        const result = await controller.notifyPaymentIssue({ invoiceIds }, MOCK_ADMIN_USER);

        expect(result).toEqual({ sent: 3, skipped: [] });
        expect(rabbitmqProducer.emit).toHaveBeenCalledTimes(3);
        for (const id of invoiceIds) {
            expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
                'payment.issue_alternative',
                expect.objectContaining({ order_id: id, email: `${id}@example.com` }),
            );
        }
    });

    it('skips invoices absent from the DB lookup without aborting the rest', async () => {
        prisma.applicationInvoice.findMany.mockResolvedValue([makeInvoice('1')]);

        const result = await controller.notifyPaymentIssue(
            { invoiceIds: ['1', 'missing'] },
            MOCK_ADMIN_USER,
        );

        expect(result.sent).toBe(1);
        expect(result.skipped).toEqual([{ invoiceId: 'missing', reason: 'invoice_not_found' }]);
    });

    it('records emit_failed and keeps processing the rest of the chunk when one publish rejects', async () => {
        const invoiceIds = ['1', '2', '3'];
        prisma.applicationInvoice.findMany.mockResolvedValue(invoiceIds.map(makeInvoice));
        rabbitmqProducer.emit.mockImplementation(async (_event: string, payload: any) => {
            if (payload.order_id === '2') {
                throw new Error('publish failed');
            }
            return true;
        });

        const result = await controller.notifyPaymentIssue({ invoiceIds }, MOCK_ADMIN_USER);

        expect(result.sent).toBe(2);
        expect(result.skipped).toEqual([{ invoiceId: '2', reason: 'emit_failed' }]);
    });

    it('bounds concurrency to NOTIFY_PAYMENT_ISSUE_BATCH_SIZE instead of firing every publish at once (M154)', async () => {
        // Regression guard for the exact defect: the old code awaited
        // rabbitmqProducer.emit sequentially, one invoice at a time, inside a
        // plain for-of loop. Naively "fixing" that with an unbounded
        // Promise.allSettled(all.map(...)) would trade it for the M38 mistake
        // in reverse -- every publish in flight at once against one channel.
        // This test tracks the maximum number of concurrently in-flight emit()
        // calls and asserts it never exceeds the documented batch size.
        const BATCH_SIZE = 50;
        const invoiceIds = Array.from({ length: 137 }, (_, i) => String(i + 1));
        prisma.applicationInvoice.findMany.mockResolvedValue(invoiceIds.map(makeInvoice));

        let inFlight = 0;
        let maxInFlight = 0;
        rabbitmqProducer.emit.mockImplementation(async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setImmediate(resolve));
            inFlight -= 1;
            return true;
        });

        const result = await controller.notifyPaymentIssue({ invoiceIds }, MOCK_ADMIN_USER);

        expect(result.sent).toBe(137);
        expect(maxInFlight).toBeGreaterThan(1); // actually batches, not sequential
        expect(maxInFlight).toBeLessThanOrEqual(BATCH_SIZE);
    });
});
