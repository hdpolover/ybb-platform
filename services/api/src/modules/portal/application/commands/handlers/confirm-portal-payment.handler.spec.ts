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
});
