import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmPortalPaymentHandler } from './confirm-portal-payment.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { ConfirmPortalPaymentCommand } from '../../queries/portal-queries';

describe('ConfirmPortalPaymentHandler', () => {
    let handler: ConfirmPortalPaymentHandler;

    const mockPrisma = {
        applicationInvoice: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    const mockCacheService = {
        invalidateKey: jest.fn().mockResolvedValue(undefined),
    };

    const mockPortalCacheService = {
        getParticipantProfile: jest.fn(),
    };

    const mockPaymentClient = {
        createIntent: jest.fn(),
        submitManualPayment: jest.fn(),
        processPayment: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfirmPortalPaymentHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: PaymentGrpcClient, useValue: mockPaymentClient },
            ],
        }).compile();

        handler = module.get<ConfirmPortalPaymentHandler>(ConfirmPortalPaymentHandler);
        jest.clearAllMocks();
    });

    it('passes the program exchange rate to the payment service when older portal invoices have no snapshot', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue({
            id: 'invoice-1',
            applicationId: 'app-1',
            amount: '15',
            currency: 'USD',
            status: 'unpaid',
            exchangeRateSnapshot: null,
            paymentMethod: null,
            externalIntentId: null,
            externalTransactionId: null,
            pricingTier: {
                name: 'Registration Fee',
                isActive: true,
                deletedAt: null,
            },
            application: {
                participantId: 'participant-1',
                programId: 'program-1',
                program: {
                    name: 'China Youth Summit 2026',
                    currency: 'USD',
                    usdInIdr: '17580',
                },
                participant: {
                    fullName: 'Hendra',
                    user: {
                        email: 'hendra@example.com',
                    },
                },
            },
        });
        mockPaymentClient.createIntent.mockResolvedValue({
            intent_id: 'intent-1',
        });
        mockPaymentClient.processPayment.mockResolvedValue({
            status: 'PENDING',
            transaction_id: 'tx-1',
            action: {
                type: 'redirect',
                url: 'https://checkout.xendit.co/invoice/test',
            },
        });
        mockPrisma.applicationInvoice.update.mockResolvedValue(undefined);

        await handler.execute(
            new ConfirmPortalPaymentCommand('user-1', 'invoice-1', 'gateway', 'xendit_credit_card'),
        );

        expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 15,
                currency: 'USD',
                exchange_rate: 17580,
                reference_type: 'invoice',
                reference_id: 'invoice-1',
            }),
        );
    });

    it('flips the invoice to IDR settlement when the participant chooses manual transfer', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue({
            id: 'invoice-1',
            applicationId: 'app-1',
            // Canonical USD on the unpaid invoice. The manual confirm should
            // swap this to the IDR snapshot before talking to payment-service
            // because that's the currency the participant actually wired.
            amount: '15',
            currency: 'USD',
            amountUsd: '15',
            amountIdr: '240000',
            status: 'unpaid',
            exchangeRateSnapshot: '16000',
            paymentMethod: null,
            externalIntentId: null,
            externalTransactionId: null,
            pricingTier: {
                name: 'Registration Fee',
                isActive: true,
                deletedAt: null,
            },
            application: {
                participantId: 'participant-1',
                programId: 'program-1',
                program: {
                    name: 'China Youth Summit 2026',
                    currency: 'USD',
                    usdInIdr: '16000',
                    brandId: 'brand-1',
                },
                participant: {
                    fullName: 'Hendra',
                    user: { email: 'hendra@example.com' },
                },
            },
        });
        mockPaymentClient.createIntent.mockResolvedValue({ intent_id: 'intent-1' });
        mockPaymentClient.submitManualPayment.mockResolvedValue({ transaction_id: 'tx-manual-1' });
        mockPrisma.applicationInvoice.update.mockResolvedValue(undefined);

        await handler.execute(
            new ConfirmPortalPaymentCommand(
                'user-1',
                'invoice-1',
                'manual',
                'mandiri_gm84xd',
                {
                    accountName: 'Hendra',
                    sourceName: 'BCA 1234',
                    paymentDate: '2026-05-06',
                    proofFileId: 'file-1',
                    proofFileUrl: 'https://example.com/proof.jpg',
                },
            ),
        );

        expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 240000,
                currency: 'IDR',
                reference_id: 'invoice-1',
            }),
        );
        expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'invoice-1' },
                data: expect.objectContaining({
                    status: 'processing',
                    paymentMethod: 'mandiri_gm84xd',
                    amount: 240000,
                    currency: 'IDR',
                }),
            }),
        );
    });

    it('keeps USD settlement on manual confirm when no IDR snapshot is available (legacy tier)', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue({
            id: 'invoice-1',
            applicationId: 'app-1',
            amount: '15',
            currency: 'USD',
            amountUsd: null,
            amountIdr: null,
            status: 'unpaid',
            exchangeRateSnapshot: '16000',
            paymentMethod: null,
            externalIntentId: null,
            externalTransactionId: null,
            pricingTier: { name: 'Registration Fee', isActive: true, deletedAt: null },
            application: {
                participantId: 'participant-1',
                programId: 'program-1',
                program: {
                    name: 'China Youth Summit 2026',
                    currency: 'USD',
                    usdInIdr: '16000',
                    brandId: 'brand-1',
                },
                participant: { fullName: 'Hendra', user: { email: 'hendra@example.com' } },
            },
        });
        mockPaymentClient.createIntent.mockResolvedValue({ intent_id: 'intent-1' });
        mockPaymentClient.submitManualPayment.mockResolvedValue({ transaction_id: 'tx-manual-2' });
        mockPrisma.applicationInvoice.update.mockResolvedValue(undefined);

        await handler.execute(
            new ConfirmPortalPaymentCommand(
                'user-1',
                'invoice-1',
                'manual',
                'mandiri_gm84xd',
                {
                    accountName: 'Hendra',
                    sourceName: 'BCA 1234',
                    paymentDate: '2026-05-06',
                    proofFileId: 'file-1',
                    proofFileUrl: 'https://example.com/proof.jpg',
                },
            ),
        );

        expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 15, currency: 'USD' }),
        );
        const updateCall = mockPrisma.applicationInvoice.update.mock.calls[0][0];
        expect(updateCall.data.amount).toBeUndefined();
        expect(updateCall.data.currency).toBeUndefined();
    });
});
