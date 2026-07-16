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

function makeRmqContext(): RmqContext {
    const ack = jest.fn();
    const nack = jest.fn();
    const channel = { ack, nack };
    const message = { properties: { headers: {} } };
    return {
        getChannelRef: () => channel,
        getMessage: () => message,
        getPattern: () => 'payment.succeeded',
    } as unknown as RmqContext;
}

describe('PaymentEventsController — idempotency on redelivered event', () => {
    let controller: PaymentEventsController;
    let fakeTx: {
        participantApplication: { update: jest.Mock };
        applicationInvoice: {
            update: jest.Mock;
            create: jest.Mock;
            findFirst: jest.Mock;
        };
    };

    beforeEach(async () => {
        fakeTx = {
            participantApplication: {
                update: jest.fn().mockResolvedValue({ id: 'app-1' }),
            },
            applicationInvoice: {
                update: jest.fn().mockResolvedValue({ id: 'inv-existing' }),
                create: jest.fn().mockResolvedValue({ id: 'inv-new' }),
                findFirst: jest.fn().mockResolvedValue(null),
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
                findUnique: jest.fn().mockResolvedValue(null),
                findFirst: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue({ id: 'inv-existing' }),
            },
            $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) =>
                Promise.all(ops),
            ),
        };

        const mockProducer = { emit: jest.fn().mockResolvedValue(true) };
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
    });

    describe('handlePaymentSucceeded — redelivered event with same transactionId', () => {
        it('updates existing invoice instead of creating a duplicate when transactionId already exists', async () => {
            // Simulate: invoice with same transaction_id already exists (processing status)
            fakeTx.applicationInvoice.findFirst.mockResolvedValue({
                id: 'inv-existing',
                status: 'processing',
            });

            const payload = {
                email: 'john@example.com',
                amount: 500000,
                currency: 'IDR',
                transaction_id: 'txn-123',
                payment_id: 'txn-123',
                metadata: {
                    // No invoice_id — goes to CREATE path where idempotency check runs
                    application_id: 'app-1',
                    customer_name: 'John Doe',
                    description: 'Registration fee',
                },
            };

            const context = makeRmqContext();
            await controller.handlePaymentSucceeded(payload as any, context);

            // Should NOT have created a new invoice
            expect(fakeTx.applicationInvoice.create).not.toHaveBeenCalled();
            // Should have updated the existing invoice in-place
            expect(fakeTx.applicationInvoice.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'inv-existing' },
                    data: expect.objectContaining({
                        status: 'paid',
                    }),
                }),
            );
        });

        it('creates a new invoice when no existing invoice matches the transactionId', async () => {
            // No duplicate exists
            fakeTx.applicationInvoice.findFirst.mockResolvedValue(null);

            const payload = {
                email: 'john@example.com',
                amount: 500000,
                currency: 'IDR',
                transaction_id: 'txn-brand-new',
                payment_id: 'txn-brand-new',
                metadata: {
                    application_id: 'app-1',
                    customer_name: 'John Doe',
                    description: 'Registration fee',
                },
            };

            const context = makeRmqContext();
            await controller.handlePaymentSucceeded(payload as any, context);

            // Should have created a new invoice since no duplicate found
            expect(fakeTx.applicationInvoice.create).toHaveBeenCalled();
        });
    });

    describe('handlePaymentSucceeded — payment method persistence', () => {
        it('writes the real payment method onto the existing invoice when the event carries payment_method_id', async () => {
            const payload = {
                email: 'john@example.com',
                amount: 500000,
                currency: 'IDR',
                transaction_id: 'txn-method-1',
                payment_id: 'txn-method-1',
                payment_method_id: 'midtrans_cc',
                metadata: {
                    application_id: 'app-1',
                    invoice_id: 'inv-existing',
                    customer_name: 'John Doe',
                    description: 'Registration fee',
                },
            };

            await controller.handlePaymentSucceeded(payload as any, makeRmqContext());

            expect(fakeTx.applicationInvoice.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'inv-existing' },
                    data: expect.objectContaining({ paymentMethod: 'midtrans_cc' }),
                }),
            );
        });

        it('does NOT write the literal "unknown" and leaves the existing paymentMethod untouched when the event carries no method', async () => {
            const payload = {
                email: 'john@example.com',
                amount: 500000,
                currency: 'IDR',
                transaction_id: 'txn-method-2',
                payment_id: 'txn-method-2',
                // No payment_method_id / payment_method / method field at all — this is
                // the shape of an event published before the payment service carried
                // the method (or one from an older, in-flight message).
                metadata: {
                    application_id: 'app-1',
                    invoice_id: 'inv-existing',
                    customer_name: 'John Doe',
                    description: 'Registration fee',
                },
            };

            await controller.handlePaymentSucceeded(payload as any, makeRmqContext());

            const updateCall = fakeTx.applicationInvoice.update.mock.calls.find(
                ([args]: [{ where: { id: string } }]) => args.where.id === 'inv-existing',
            );
            expect(updateCall).toBeDefined();
            const data = updateCall![0].data as Record<string, unknown>;
            expect(data.paymentMethod).not.toBe('unknown');
            // Field must be omitted entirely (Prisma skips undefined keys), so the
            // invoice keeps whatever paymentMethod it already had (e.g. set at
            // confirm-portal-payment time), rather than being overwritten.
            expect('paymentMethod' in data).toBe(false);
        });

        it('writes null (not "unknown") for a brand-new invoice when the event carries no method', async () => {
            fakeTx.applicationInvoice.findFirst.mockResolvedValue(null);

            const payload = {
                email: 'john@example.com',
                amount: 500000,
                currency: 'IDR',
                transaction_id: 'txn-method-3',
                payment_id: 'txn-method-3',
                metadata: {
                    // No invoice_id — goes to the CREATE path
                    application_id: 'app-1',
                    customer_name: 'John Doe',
                    description: 'Registration fee',
                },
            };

            await controller.handlePaymentSucceeded(payload as any, makeRmqContext());

            expect(fakeTx.applicationInvoice.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ paymentMethod: null }),
                }),
            );
        });
    });
});
