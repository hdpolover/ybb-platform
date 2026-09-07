// src/modules/payments/presentation/__tests__/payment-events.controller.conversion-tracking.spec.ts
//
// Covers the server-side Purchase/ProgramFeePaid conversion emit added to
// handlePaymentSucceeded: the fee-type -> event-name/event-id mapping, that it
// is suppressed on a replay of an already-paid invoice, and that a throwing
// MetaCapiService never breaks the payment-processing flow that triggered it.
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentEventsController } from '../payment-events.controller';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PaymentOutboxService } from '../../infrastructure/services/payment-outbox.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { MetaCapiService } from '@modules/meta/meta-capi.service';
import { RmqContext } from '@nestjs/microservices';

function makeRmqContext(): RmqContext {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const message = { properties: { headers: {} } };
    return {
        getChannelRef: () => channel,
        getMessage: () => message,
        getPattern: () => 'payment.succeeded',
    } as unknown as RmqContext;
}

function invoiceWithBrandFixture(overrides: Record<string, unknown> = {}) {
    return {
        id: 'inv-new',
        amount: 500000,
        currency: 'IDR',
        pricingTier: { feeType: 'registration_fee' },
        application: {
            applicationCategory: 'self_funded',
            participant: {
                userId: 'user-1',
                phoneNumber: null,
                phoneCountryCode: null,
                user: { email: 'john@example.com' },
                adAttribution: { fbp: 'fb.1.111.222', fbc: 'fb.1.111.click', capturedAt: '2026-01-01T00:00:00.000Z' },
            },
            program: { id: 'program-1', brandId: 'brand-1' },
        },
        ...overrides,
    };
}

describe('PaymentEventsController — server-side conversion tracking', () => {
    let controller: PaymentEventsController;
    let mockPrisma: {
        participantApplication: { findUnique: jest.Mock; update: jest.Mock };
        applicationInvoice: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    };
    let fakeTx: {
        participantApplication: { update: jest.Mock };
        applicationInvoice: { update: jest.Mock; create: jest.Mock; findFirst: jest.Mock };
    };
    let emitServerEvent: jest.Mock;

    async function buildController() {
        fakeTx = {
            participantApplication: { update: jest.fn().mockResolvedValue({ id: 'app-1' }) },
            applicationInvoice: {
                update: jest.fn().mockResolvedValue({ id: 'inv-existing' }),
                create: jest.fn().mockResolvedValue({ id: 'inv-new' }),
                findFirst: jest.fn().mockResolvedValue(null),
            },
        };

        const mockUnitOfWork = {
            execute: jest.fn().mockImplementation((work: (repos: { tx: typeof fakeTx }) => Promise<unknown>) =>
                work({ tx: fakeTx }),
            ),
        };

        mockPrisma = {
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
                // The only findUnique call in the no-metadata.invoice_id path is the
                // post-transaction invoiceWithBrand lookup used for both the
                // notification email and the conversion emit.
                findUnique: jest.fn().mockResolvedValue(invoiceWithBrandFixture()),
                findFirst: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue({ id: 'inv-existing' }),
            },
        };

        emitServerEvent = jest.fn().mockResolvedValue(undefined);

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentEventsController],
            providers: [
                { provide: MetricsService, useValue: { paymentTotal: { inc: jest.fn() }, paymentAmount: { observe: jest.fn() }, jobProcessingDuration: { observe: jest.fn() } } },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: UnitOfWork, useValue: mockUnitOfWork },
                { provide: CacheService, useValue: { invalidateKey: jest.fn().mockResolvedValue(undefined), invalidateByPattern: jest.fn().mockResolvedValue(undefined) } },
                { provide: PaymentOutboxService, useValue: { enqueueInTransaction: jest.fn().mockResolvedValue({ queued: true, dedupeKey: 'key-1' }), isEnabled: jest.fn().mockReturnValue(false) } },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn().mockResolvedValue(true) } },
                { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) } },
                { provide: MetaCapiService, useValue: { emitServerEvent } },
            ],
        }).compile();

        controller = module.get<PaymentEventsController>(PaymentEventsController);
    }

    beforeEach(async () => {
        await buildController();
    });

    function basePayload(overrides: Record<string, unknown> = {}) {
        return {
            email: 'john@example.com',
            amount: 500000,
            currency: 'IDR',
            transaction_id: 'txn-conv-1',
            payment_id: 'txn-conv-1',
            metadata: {
                application_id: 'app-1',
                payment_category: 'registration',
                customer_name: 'John Doe',
                description: 'Registration fee',
            },
            ...overrides,
        };
    }

    it('fires Purchase with eventId purchase_<invoiceId> for a registration_fee invoice', async () => {
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(
            invoiceWithBrandFixture({ id: 'inv-new', pricingTier: { feeType: 'registration_fee' } }),
        );

        await controller.handlePaymentSucceeded(basePayload() as any, makeRmqContext());

        expect(emitServerEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                brandId: 'brand-1',
                eventName: 'Purchase',
                eventId: 'purchase_inv-new',
                customData: expect.objectContaining({ value: 500000, currency: 'IDR', content_category: 'self_funded' }),
            }),
        );
    });

    it("replays the participant's stored ad_attribution click ids onto the conversion event", async () => {
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(
            invoiceWithBrandFixture({ id: 'inv-new', pricingTier: { feeType: 'registration_fee' } }),
        );

        await controller.handlePaymentSucceeded(basePayload() as any, makeRmqContext());

        expect(emitServerEvent).toHaveBeenCalledWith(
            expect.objectContaining({ fbp: 'fb.1.111.222', fbc: 'fb.1.111.click' }),
        );
    });

    it('fires ProgramFeePaid with eventId programfee_<invoiceId> for a non-registration fee type (program_fee_1)', async () => {
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(
            invoiceWithBrandFixture({ id: 'inv-new', pricingTier: { feeType: 'program_fee_1' } }),
        );

        await controller.handlePaymentSucceeded(
            basePayload({ metadata: { application_id: 'app-1', payment_category: 'program' } }) as any,
            makeRmqContext(),
        );

        expect(emitServerEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventName: 'ProgramFeePaid', eventId: 'programfee_inv-new' }),
        );
    });

    it('does NOT fire the conversion event when the invoice was already paid (idempotent replay)', async () => {
        // existingByRef branch: an invoice already exists for this transaction and
        // is already 'paid' — the real transition already happened on an earlier
        // delivery, so this replay must not double-fire the conversion event.
        fakeTx.applicationInvoice.findFirst.mockResolvedValue({ id: 'inv-existing', status: 'paid' });

        await controller.handlePaymentSucceeded(basePayload() as any, makeRmqContext());

        expect(emitServerEvent).not.toHaveBeenCalled();
    });

    it('never lets a throwing MetaCapiService.emitServerEvent break the payment-processing flow', async () => {
        emitServerEvent.mockImplementation(() => {
            throw new Error('meta capi is down');
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(invoiceWithBrandFixture());

        await expect(controller.handlePaymentSucceeded(basePayload() as any, makeRmqContext())).resolves.toBeUndefined();
        // The application status update still went through despite the throw.
        expect(fakeTx.participantApplication.update).toHaveBeenCalled();
    });
});
