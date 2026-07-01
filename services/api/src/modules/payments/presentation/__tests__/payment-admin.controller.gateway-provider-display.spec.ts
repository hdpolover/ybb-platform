import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';

describe('PaymentAdminController.getInvoice — gateway_response.provider display', () => {
    let controller: PaymentAdminController;

    const invoiceRow = {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'paid',
        paymentMethod: null as string | null,
        externalIntentId: null as string | null,
        externalTransactionId: 'txn-1',
        pricingTier: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        application: { participant: { user: {} } },
    };

    async function buildController(paymentClientGet: jest.Mock): Promise<PaymentAdminController> {
        const mockPaymentClient = {
            get: paymentClientGet,
            post: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn() } },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: {} },
                {
                    provide: PrismaService,
                    useValue: { applicationInvoice: { findUnique: jest.fn().mockResolvedValue(invoiceRow) } },
                },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        const builtController = module.get<PaymentAdminController>(PaymentAdminController);
        jest
            .spyOn(
                builtController as unknown as { getPaymentMethodCatalog: () => Promise<unknown[]> },
                'getPaymentMethodCatalog',
            )
            .mockResolvedValue([]);
        return builtController;
    }

    it('labels the transaction using gateway_response.provider (xendit), not the legacy midtrans_cc code', async () => {
        controller = await buildController(
            jest.fn().mockResolvedValue({
                data: {
                    type: 'transaction',
                    id: 'txn-1',
                    status: 'SUCCESS',
                    payment_method_id: 'midtrans_cc',
                    gateway_response: { provider: 'xendit', token: 'xnd-token-1' },
                },
            }),
        );

        const result = await controller.getInvoice(invoiceRow.id);

        expect((result.transaction as Record<string, unknown>).payment_method_label).toBe('Xendit');
    });

    it('falls back to the legacy method-code-derived label when gateway_response.provider is absent', async () => {
        controller = await buildController(
            jest.fn().mockResolvedValue({
                data: {
                    type: 'transaction',
                    id: 'txn-1',
                    status: 'SUCCESS',
                    payment_method_id: 'midtrans_cc',
                },
            }),
        );

        const result = await controller.getInvoice(invoiceRow.id);

        expect((result.transaction as Record<string, unknown>).payment_method_label).toBe('Midtrans Cc');
    });
});
