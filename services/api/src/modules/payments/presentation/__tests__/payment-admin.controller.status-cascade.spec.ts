// services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.status-cascade.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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

const MOCK_ADMIN: CurrentUserData = { userId: 'admin-1', email: 'a@test.com', brandId: 'b1', role: [], adminId: 'admin-id-1' };

describe('PaymentAdminController.updateInvoiceStatus — Go cascade parity', () => {
    let controller: PaymentAdminController;
    let mockGatewayClient: { voidTransaction: jest.Mock };
    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock; update: jest.Mock };
        participantApplication: { update: jest.Mock };
        $transaction: jest.Mock;
    };

    const invoiceRow = {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'processing',
        externalTransactionId: 'txn-1',
        externalIntentId: 'intent-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        pricingTier: { feeType: 'registration_fee' },
        application: { id: 'app-1', participant: { userId: 'user-1' } },
    };

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
        mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(invoiceRow),
                update: jest.fn().mockResolvedValue({ ...invoiceRow, status: 'cancelled' }),
            },
            participantApplication: { update: jest.fn().mockResolvedValue({}) },
            $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: { get: jest.fn(), post: jest.fn() } },
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: { invalidateInvoiceCache: jest.fn() } },
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

    it('voids the Go transaction when an admin sets status=cancelled', async () => {
        await controller.updateInvoiceStatus(
            invoiceRow.id,
            { status: 'cancelled' as any, reason: 'duplicate application' },
            MOCK_ADMIN,
        );

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', invoiceRow.id, expect.any(String));
    });

    it('refuses the status change when the gateway reports danger_settled', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });

        await expect(
            controller.updateInvoiceStatus(invoiceRow.id, { status: 'cancelled' as any, reason: 'duplicate' }, MOCK_ADMIN),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('fails closed and refuses the status change when the gateway status could not be verified (outcome: error)', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'error', detail: 'gateway timeout' });

        await expect(
            controller.updateInvoiceStatus(invoiceRow.id, { status: 'cancelled' as any, reason: 'duplicate' }, MOCK_ADMIN),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses the status change when the linked transaction is awaiting manual review (outcome: needs_review)', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({
            outcome: 'needs_review',
            detail: 'transaction is awaiting manual review; refusing to void',
        });

        await expect(
            controller.updateInvoiceStatus(invoiceRow.id, { status: 'cancelled' as any, reason: 'duplicate' }, MOCK_ADMIN),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
