// src/modules/payments/presentation/__tests__/payment-admin.controller.resend-receipt.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

const INVOICE_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

const MOCK_ADMIN_USER: CurrentUserData = {
    userId: 'admin-1',
    email: 'admin@test.com',
    brandId: 'brand-1',
    role: [],
    adminId: 'admin-id-1',
};

const MOCK_BRAND = {
    id: 'brand-1',
    name: 'Test Brand',
    primaryColor: '#FF5500',
    logoUrl: 'https://example.com/logo.png',
    websiteUrl: 'https://example.com',
    landingUrl: 'https://example.com',
    contactEmail: 'info@example.com',
    contactPhone: '+62-812-0000-0000',
    contactAddress: '123 Test St',
};

function makePaidInvoice(overrides: Record<string, unknown> = {}) {
    return {
        id: INVOICE_ID,
        applicationId: 'app-1',
        amount: 1500000,
        currency: 'IDR',
        status: 'paid',
        externalTransactionId: 'txn-1',
        pricingTier: { name: 'Program Fee Tier 1' },
        application: {
            id: 'app-1',
            participant: {
                fullName: 'Jane Doe',
                userId: 'user-1',
                user: { email: 'jane@example.com' },
            },
            program: {
                id: 'program-1',
                name: 'YBB Program',
                brand: MOCK_BRAND,
            },
        },
        ...overrides,
    };
}

describe('PaymentAdminController — resendReceipt', () => {
    let controller: PaymentAdminController;
    let rabbitmqProducer: jest.Mocked<RabbitMQProducerService>;
    let prisma: { applicationInvoice: { findUnique: jest.Mock } };

    beforeEach(async () => {
        const mockRabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };
        const mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(makePaidInvoice()),
            },
        };
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
    });

    it('emits notification.receipt_requested with the expected payload for a paid invoice', async () => {
        const result = await controller.resendReceipt({ invoiceId: INVOICE_ID }, MOCK_ADMIN_USER);

        expect(result).toEqual({ sent: true, email: 'jane@example.com' });
        expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
            'notification.receipt_requested',
            expect.objectContaining({
                email: 'jane@example.com',
                customer_name: 'Jane Doe',
                amount: 1500000,
                currency: 'IDR',
                order_id: INVOICE_ID,
                payment_id: 'txn-1',
                metadata: expect.objectContaining({
                    description: 'Payment for Program Fee Tier 1',
                    invoice_id: INVOICE_ID,
                    application_id: 'app-1',
                    triggered_by: 'admin-1',
                }),
                brand: expect.objectContaining({
                    name: 'Test Brand',
                    primaryColor: '#FF5500',
                    logoUrl: 'https://example.com/logo.png',
                    contactEmail: 'info@example.com',
                    contactPhone: '+62-812-0000-0000',
                    contactAddress: '123 Test St',
                    websiteUrl: 'https://example.com',
                }),
            }),
        );
    });

    it('uses invoice.currency/amount as the money truth, not FX-equivalent fields', async () => {
        (prisma.applicationInvoice.findUnique as jest.Mock).mockResolvedValue(
            makePaidInvoice({
                amount: 99,
                currency: 'USD',
                // If the handler ever reads these instead, this test should fail.
                amount_idr: 1548000,
                amount_usd: 99,
            }),
        );

        await controller.resendReceipt({ invoiceId: INVOICE_ID }, MOCK_ADMIN_USER);

        expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
            'notification.receipt_requested',
            expect.objectContaining({ amount: 99, currency: 'USD' }),
        );
    });

    it('throws 400 for a non-paid invoice and does not emit', async () => {
        (prisma.applicationInvoice.findUnique as jest.Mock).mockResolvedValue(
            makePaidInvoice({ status: 'unpaid' }),
        );

        await expect(
            controller.resendReceipt({ invoiceId: INVOICE_ID }, MOCK_ADMIN_USER),
        ).rejects.toThrow(BadRequestException);
        expect(rabbitmqProducer.emit).not.toHaveBeenCalled();
    });

    it('throws 404 for a missing invoice and does not emit', async () => {
        (prisma.applicationInvoice.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
            controller.resendReceipt({ invoiceId: INVOICE_ID }, MOCK_ADMIN_USER),
        ).rejects.toThrow(NotFoundException);
        expect(rabbitmqProducer.emit).not.toHaveBeenCalled();
    });
});
