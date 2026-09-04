import { Test, TestingModule } from '@nestjs/testing';
import { PaymentEventsController } from '../payment-events.controller';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PaymentOutboxService } from '../../infrastructure/services/payment-outbox.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { RmqContext } from '@nestjs/microservices';

// ── Fixtures ─────────────────────────────────────────────────────────────────

// contactEmail/contactAddress live on Program as of Phase 3
// (docs/superpowers/specs/2026-08-23-program-content-copy-design.md) — the
// controllers read them as siblings of `brand`, not nested inside it, so
// the fixture below puts them on MOCK_PROGRAM, not MOCK_BRAND.
const MOCK_BRAND = {
    id: 'brand-1',
    name: 'Test Brand',
    primaryColor: '#FF5500',
    logoUrl: 'https://example.com/logo.png',
    websiteUrl: 'https://example.com',
    landingUrl: 'https://example.com',
    socialMediaLinks: {},
    settings: {
        footerNavigation: [],
        supportEmail: 'support@example.com',
    },
};

const MOCK_PARTICIPANT = {
    id: 'participant-1',
    userId: 'user-1',
    fullName: 'John Doe',
    user: { email: 'john@example.com' },
};

const MOCK_PROGRAM = {
    id: 'program-1',
    usdInIdr: null,
    contactEmail: 'info@example.com',
    contactAddress: '123 Test St',
    brand: MOCK_BRAND,
};

const MOCK_INVOICE_WITH_BRAND = {
    id: 'invoice-1',
    applicationId: 'app-1',
    status: 'pending',
    amount: 500000,
    currency: 'IDR',
    externalTransactionId: 'txn-1',
    application: {
        id: 'app-1',
        participant: MOCK_PARTICIPANT,
        program: MOCK_PROGRAM,
    },
};

const MOCK_INVOICE_NO_BRAND = {
    ...MOCK_INVOICE_WITH_BRAND,
    application: {
        ...MOCK_INVOICE_WITH_BRAND.application,
        program: { ...MOCK_PROGRAM, brand: null },
    },
};

// ── RmqContext helper ────────────────────────────────────────────────────────

function makeRmqContext(overrides: Record<string, unknown> = {}): RmqContext {
    const ack = jest.fn();
    const nack = jest.fn();
    const channel = { ack, nack };
    const message = { properties: { headers: {} } };
    return {
        getChannelRef: () => channel,
        getMessage: () => message,
        getPattern: () => 'payment.succeeded',
        ...overrides,
    } as unknown as RmqContext;
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('PaymentEventsController — brand-aware notification re-emit', () => {
    let controller: PaymentEventsController;
    let producer: jest.Mocked<RabbitMQProducerService>;
    let prisma: jest.Mocked<PrismaService>;
    // Exposed so a test can assert on the write that happens INSIDE the unit of
    // work, which is where the application payment column is set.
    let tx: { participantApplication: { update: jest.Mock } };
    let unitOfWork: jest.Mocked<UnitOfWork>;
    let paymentOutbox: jest.Mocked<PaymentOutboxService>;

    beforeEach(async () => {
        const mockProducer = { emit: jest.fn().mockResolvedValue(true) };

        // Fake tx that mirrors prisma operations
        const fakeTx = {
            participantApplication: {
                update: jest.fn().mockResolvedValue({ id: 'app-1' }),
            },
            applicationInvoice: {
                update: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
                create: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
            },
        };

        const mockUnitOfWork = {
            execute: jest.fn().mockImplementation(
                async (work: (repos: { tx: typeof fakeTx }) => Promise<unknown>) => {
                    return work({ tx: fakeTx });
                },
            ),
        };

        const mockPrisma = {
            participantApplication: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'app-1',
                    programId: 'program-1',
                    pricingTierId: 'tier-1',
                    participant: { id: 'participant-1', userId: 'user-1' },
                    program: { id: 'program-1', usdInIdr: null },
                }),
                update: jest.fn().mockResolvedValue({}),
            },
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(MOCK_INVOICE_WITH_BRAND),
                // Default to NO paid sibling. This mock is consulted by the
                // supersede guard as well as by resolveFailureInvoice's fallback,
                // and MOCK_INVOICE_WITH_BRAND is not a paid invoice, so a real DB
                // would never return it as a paid sibling. Returning it here made
                // every succeeded event look like a duplicate settlement.
                findFirst: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            // $transaction receives an array of promises (from prisma.model.update calls), resolve them all
            $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) =>
                Promise.all(ops),
            ),
        };

        const mockMetrics = {
            paymentTotal: { inc: jest.fn() },
            paymentAmount: { observe: jest.fn() },
            jobProcessingDuration: { observe: jest.fn() },
        };

        const mockCache = {
            invalidateKey: jest.fn().mockResolvedValue(undefined),
            invalidateByPattern: jest.fn().mockResolvedValue(undefined),
        };

        const mockPaymentOutbox = {
            enqueueInTransaction: jest.fn().mockResolvedValue({ queued: true, dedupeKey: 'key-1' }),
            isEnabled: jest.fn().mockReturnValue(false),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentEventsController],
            providers: [
                { provide: MetricsService, useValue: mockMetrics },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: UnitOfWork, useValue: mockUnitOfWork },
                { provide: CacheService, useValue: mockCache },
                { provide: PaymentOutboxService, useValue: mockPaymentOutbox },
                { provide: RabbitMQProducerService, useValue: mockProducer },
                { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) } },
            ],
        }).compile();

        controller = module.get<PaymentEventsController>(PaymentEventsController);
        producer = module.get(RabbitMQProducerService);
        prisma = module.get(PrismaService);
        tx = fakeTx;
        unitOfWork = module.get(UnitOfWork);
        paymentOutbox = module.get(PaymentOutboxService);
    });

    // ── handlePaymentSucceeded ──────────────────────────────────────────────

    describe('handlePaymentSucceeded', () => {
        const basePayload = {
            email: 'john@example.com',
            amount: 500000,
            currency: 'IDR',
            payment_id: 'txn-1',
            metadata: {
                application_id: 'app-1',
                invoice_id: 'invoice-1',
                customer_name: 'John Doe',
                description: 'Registration fee',
            },
        };

        it('should emit notification.payment_succeeded with brand payload', async () => {
            const context = makeRmqContext();

            await controller.handlePaymentSucceeded(basePayload as any, context);

            expect(producer.emit).toHaveBeenCalledWith(
                'notification.payment_succeeded',
                expect.objectContaining({
                    brand: expect.objectContaining({
                        name: 'Test Brand',
                        primaryColor: '#FF5500',
                        logoUrl: 'https://example.com/logo.png',
                        // Sourced from Program, not Brand, as of Phase 3.
                        contactEmail: 'info@example.com',
                        contactAddress: '123 Test St',
                        settings: expect.objectContaining({
                            supportEmail: 'support@example.com',
                        }),
                    }),
                }),
            );
        });

        // Audit M158/M65, paid direction. A paid sibling does NOT mean "suppress
        // the write" here: both invoices settle the same column to 'paid', so the
        // write is idempotent, and it is also the only thing that repairs a column
        // an earlier cancel wrongly left at 'cancelled'. Gating it would delete
        // that self-heal. What a paid sibling means is that the column was paid
        // twice - real money - so the duplicate invoice is flagged for refund
        // review instead.
        it('still writes paid and flags the duplicate for refund review when a paid sibling exists', async () => {
            (prisma.applicationInvoice.findFirst as jest.Mock).mockResolvedValue({ id: 'inv-already-paid' });

            const context = makeRmqContext();

            await controller.handlePaymentSucceeded(basePayload as any, context);

            // The self-heal: the application column is still written to paid.
            expect(tx.participantApplication.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'app-1' },
                    data: expect.objectContaining({ registrationPaymentStatus: 'paid' }),
                }),
            );

            // The duplicate is flagged, and only when no reason is recorded yet.
            expect(prisma.applicationInvoice.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ rejectionReason: null }),
                    data: expect.objectContaining({
                        rejectionReason: expect.stringContaining('inv-already-paid'),
                    }),
                }),
            );
        });

        it('does not flag anything for refund review when there is no paid sibling', async () => {
            const context = makeRmqContext();

            await controller.handlePaymentSucceeded(basePayload as any, context);

            expect(prisma.applicationInvoice.updateMany).not.toHaveBeenCalled();
        });

        it('should emit notification.payment_succeeded with brand: null when invoice has no brand', async () => {
            (prisma.applicationInvoice.findUnique as jest.Mock).mockResolvedValue(MOCK_INVOICE_NO_BRAND);

            const context = makeRmqContext();

            await controller.handlePaymentSucceeded(basePayload as any, context);

            expect(producer.emit).toHaveBeenCalledWith(
                'notification.payment_succeeded',
                expect.objectContaining({ brand: null }),
            );
        });
    });

    // ── handlePaymentFailed ────────────────────────────────────────────────

    describe('handlePaymentFailed', () => {
        const basePayload = {
            email: 'john@example.com',
            amount: 500000,
            currency: 'IDR',
            payment_id: 'txn-1',
            metadata: {
                application_id: 'app-1',
                invoice_id: 'invoice-1',
                customer_name: 'John Doe',
                failure_reason: 'Card declined',
            },
        };

        beforeEach(() => {
            // resolveFailureInvoice uses findFirst/findUnique; we need a resolvable invoice
            // that also contains pricingTier and application.participant.userId for markInvoiceFailed
            const failureInvoice = {
                id: 'invoice-1',
                applicationId: 'app-1',
                status: 'pending',
                rejectionReason: null,
                paymentMethod: null,
                externalIntentId: null,
                externalTransactionId: 'txn-1',
                pricingTier: { feeType: 'program_fee' },
                application: {
                    participant: { userId: 'user-1' },
                },
            };
            (prisma.applicationInvoice.findUnique as jest.Mock).mockResolvedValue(failureInvoice);
            // findFirst here is the supersede guard's paid-sibling lookup, not
            // resolveFailureInvoice (invoiceId is always set in this describe
            // block's payloads, so that always resolves via findUnique above).
            // failureInvoice.status is 'pending', not 'paid', so a real DB would
            // never return it as a paid sibling - default to null accordingly.
            (prisma.applicationInvoice.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);
        });

        it('should emit notification.payment_failed with brand payload', async () => {
            // Second findUnique call (for brand resolution) returns full invoice with brand
            (prisma.applicationInvoice.findUnique as jest.Mock)
                .mockResolvedValueOnce({
                    id: 'invoice-1',
                    applicationId: 'app-1',
                    status: 'pending',
                    rejectionReason: null,
                    paymentMethod: null,
                    externalIntentId: null,
                    externalTransactionId: 'txn-1',
                    pricingTier: { feeType: 'program_fee' },
                    application: { participant: { userId: 'user-1' } },
                })
                .mockResolvedValueOnce(MOCK_INVOICE_WITH_BRAND);

            const context = makeRmqContext({ getPattern: () => 'payment.failed' });

            await controller.handlePaymentFailed(basePayload as any, context);

            expect(producer.emit).toHaveBeenCalledWith(
                'notification.payment_failed',
                expect.objectContaining({
                    brand: expect.objectContaining({
                        name: 'Test Brand',
                        primaryColor: '#FF5500',
                        contactEmail: 'info@example.com',
                        contactAddress: '123 Test St',
                        settings: expect.objectContaining({
                            supportEmail: 'support@example.com',
                        }),
                    }),
                }),
            );
        });

        it('should emit notification.payment_failed with brand: null when no brand', async () => {
            (prisma.applicationInvoice.findUnique as jest.Mock)
                .mockResolvedValueOnce({
                    id: 'invoice-1',
                    applicationId: 'app-1',
                    status: 'pending',
                    rejectionReason: null,
                    paymentMethod: null,
                    externalIntentId: null,
                    externalTransactionId: 'txn-1',
                    pricingTier: { feeType: 'program_fee' },
                    application: { participant: { userId: 'user-1' } },
                })
                .mockResolvedValueOnce(MOCK_INVOICE_NO_BRAND);

            const context = makeRmqContext({ getPattern: () => 'payment.failed' });

            await controller.handlePaymentFailed(basePayload as any, context);

            expect(producer.emit).toHaveBeenCalledWith(
                'notification.payment_failed',
                expect.objectContaining({ brand: null }),
            );
        });

        // Regression for the audit-M158/M65 fix: markInvoiceFailed must still
        // record the invoice's own failure, but not let it overwrite the
        // application column a different paid invoice already covers, and must
        // not tell the participant their payment failed when it didn't.
        it('skips the application column write and the payment_failed email when a paid sibling exists, but still marks the invoice failed', async () => {
            // The supersede guard's findFirst call resolves a paid sibling invoice.
            (prisma.applicationInvoice.findFirst as jest.Mock).mockResolvedValue({ id: 'inv-paid-sibling' });

            const context = makeRmqContext({ getPattern: () => 'payment.failed' });

            await controller.handlePaymentFailed(basePayload as any, context);

            // The invoice itself is still marked failed - it really did fail.
            expect(prisma.applicationInvoice.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'invoice-1' },
                    data: expect.objectContaining({ status: 'failed' }),
                }),
            );
            // But the application-level column must not be dragged to failed out
            // from under the already-paid sibling invoice.
            expect(prisma.participantApplication.update).not.toHaveBeenCalled();
            // And the participant must not get a "payment failed" email.
            expect(producer.emit).not.toHaveBeenCalledWith(
                'notification.payment_failed',
                expect.anything(),
            );
        });
    });

    // ── handlePaymentRefunded ──────────────────────────────────────────────

    describe('handlePaymentRefunded', () => {
        const basePayload = {
            email: 'john@example.com',
            amount: 500000,
            currency: 'IDR',
            payment_id: 'txn-1',
            metadata: {
                application_id: 'app-1',
                customer_name: 'John Doe',
            },
        };

        it('should emit notification.payment_refunded with brand payload', async () => {
            (prisma.applicationInvoice.findFirst as jest.Mock).mockResolvedValue(MOCK_INVOICE_WITH_BRAND);

            const context = makeRmqContext({ getPattern: () => 'payment.refunded' });

            await controller.handlePaymentRefunded(basePayload as any, context);

            expect(producer.emit).toHaveBeenCalledWith(
                'notification.payment_refunded',
                expect.objectContaining({
                    brand: expect.objectContaining({
                        name: 'Test Brand',
                        primaryColor: '#FF5500',
                        contactEmail: 'info@example.com',
                        contactAddress: '123 Test St',
                        settings: expect.objectContaining({
                            supportEmail: 'support@example.com',
                        }),
                    }),
                }),
            );
        });
    });

    // ── handlePaymentCreated ───────────────────────────────────────────────

    describe('handlePaymentCreated', () => {
        it('should emit notification.payment_created with brand when status is PENDING_REVIEW', async () => {
            (prisma.applicationInvoice.findFirst as jest.Mock).mockResolvedValue(MOCK_INVOICE_WITH_BRAND);

            const payload = {
                email: 'john@example.com',
                amount: 500000,
                currency: 'IDR',
                status: 'PENDING_REVIEW',
                metadata: {
                    application_id: 'app-1',
                    customer_name: 'John Doe',
                },
            };
            const context = makeRmqContext({ getPattern: () => 'payment.created' });

            await controller.handlePaymentCreated(payload as any, context);

            expect(producer.emit).toHaveBeenCalledWith(
                'notification.payment_created',
                expect.objectContaining({
                    brand: expect.objectContaining({
                        name: 'Test Brand',
                        primaryColor: '#FF5500',
                        contactEmail: 'info@example.com',
                        contactAddress: '123 Test St',
                    }),
                }),
            );
        });

        it('should NOT emit when status is not PENDING_REVIEW', async () => {
            const payload = {
                email: 'john@example.com',
                amount: 500000,
                currency: 'IDR',
                status: 'paid',
                metadata: {
                    application_id: 'app-1',
                },
            };
            const context = makeRmqContext({ getPattern: () => 'payment.created' });

            await controller.handlePaymentCreated(payload as any, context);

            expect(producer.emit).not.toHaveBeenCalled();
        });
    });
});
