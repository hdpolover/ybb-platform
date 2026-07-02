// services/api/src/modules/portal/application/commands/handlers/__tests__/cancel-portal-payment.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CancelPortalPaymentHandler } from '../cancel-portal-payment.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../../services/portal-cache.service';
import { PaymentGatewayClient } from '@modules/payments/infrastructure/services/payment-gateway.client';
import { ConfigService } from '@nestjs/config';

describe('CancelPortalPaymentHandler', () => {
    let handler: CancelPortalPaymentHandler;
    let mockGatewayClient: { voidTransaction: jest.Mock };
    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock; update: jest.Mock };
        participantApplication: { update: jest.Mock };
        $transaction: jest.Mock;
    };

    const invoiceRow = {
        id: 'inv-1',
        status: 'processing',
        externalTransactionId: 'txn-1',
        pricingTier: { feeType: 'registration_fee' },
        application: { id: 'app-1', participantId: 'part-1', programId: 'prog-1' },
    };

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
        mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(invoiceRow),
                update: jest.fn().mockResolvedValue({}),
            },
            participantApplication: { update: jest.fn().mockResolvedValue({}) },
            $transaction: jest.fn().mockResolvedValue([{}, {}]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CancelPortalPaymentHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: { invalidateInvoiceCache: jest.fn(), invalidateKey: jest.fn() } },
                { provide: PortalCacheService, useValue: { getParticipantProfile: jest.fn().mockResolvedValue({ id: 'part-1' }) } },
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
            ],
        }).compile();

        handler = module.get<CancelPortalPaymentHandler>(CancelPortalPaymentHandler);
    });

    it('voids via the shared PaymentGatewayClient instead of a raw POST', async () => {
        await handler.execute({ userId: 'user-1', invoiceId: 'inv-1', reason: 'changed my mind' } as any);

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', 'inv-1', 'changed my mind');
    });

    it('blocks the cancel and throws when the gateway reports danger_settled', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });

        await expect(
            handler.execute({ userId: 'user-1', invoiceId: 'inv-1', reason: 'changed my mind' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('fails closed and throws when the gateway status could not be verified (outcome: error)', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'error', detail: 'gateway timeout' });

        await expect(
            handler.execute({ userId: 'user-1', invoiceId: 'inv-1', reason: 'changed my mind' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('blocks the cancel and throws when the transaction is awaiting manual review (outcome: needs_review)', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({
            outcome: 'needs_review',
            detail: 'transaction is awaiting manual review; refusing to void',
        });

        await expect(
            handler.execute({ userId: 'user-1', invoiceId: 'inv-1', reason: 'changed my mind' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
