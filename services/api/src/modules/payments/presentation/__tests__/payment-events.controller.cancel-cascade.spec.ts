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
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const message = { properties: { headers: {} } };
    return {
        getChannelRef: () => channel,
        getMessage: () => message,
        getPattern: () => 'payment.cancelled',
    } as unknown as RmqContext;
}

describe('PaymentEventsController — payment.cancelled cascade void', () => {
    let controller: PaymentEventsController;
    let mockGatewayClient: { voidTransaction: jest.Mock };
    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
        participantApplication: { findUnique: jest.Mock; update: jest.Mock };
        $transaction: jest.Mock;
    };

    const invoiceRow = {
        id: 'inv-1',
        status: 'processing',
        applicationId: 'app-1',
        rejectionReason: null,
        paymentMethod: null,
        externalIntentId: 'intent-1',
        externalTransactionId: 'txn-1',
        pricingTier: { feeType: 'registration_fee' },
        application: { participant: { userId: 'user-1' } },
    };

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
        mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(invoiceRow),
                findFirst: jest.fn().mockResolvedValue(invoiceRow),
                update: jest.fn().mockResolvedValue({}),
            },
            participantApplication: {
                findUnique: jest.fn().mockResolvedValue({ participant: { userId: 'user-1' } }),
                update: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentEventsController],
            providers: [
                { provide: MetricsService, useValue: { jobProcessingDuration: { observe: jest.fn() } } },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: UnitOfWork, useValue: { execute: jest.fn() } },
                { provide: CacheService, useValue: { invalidateKey: jest.fn(), invalidateByPattern: jest.fn() } },
                { provide: PaymentOutboxService, useValue: { enqueueInTransaction: jest.fn(), isEnabled: jest.fn().mockReturnValue(false) } },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
            ],
        }).compile();

        controller = module.get<PaymentEventsController>(PaymentEventsController);
    });

    it('voids the linked Go transaction before cancelling the invoice', async () => {
        const payload = {
            metadata: { application_id: 'app-1', invoice_id: 'inv-1' },
            transaction_id: 'txn-1',
        };

        await controller.handlePaymentCancelled(payload as any, makeRmqContext());

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', 'inv-1', expect.any(String));
        expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('does NOT cancel the invoice when the gateway reports danger_settled', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });
        const payload = {
            metadata: { application_id: 'app-1', invoice_id: 'inv-1' },
            transaction_id: 'txn-1',
        };

        await controller.handlePaymentCancelled(payload as any, makeRmqContext());

        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
