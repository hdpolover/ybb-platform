import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfirmPortalPaymentHandler } from './confirm-portal-payment.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { ConfirmPortalPaymentCommand } from '../../queries/portal-queries';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';

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

    const mockRegistrationFeeGate = {
        isRegistrationFeePaid: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfirmPortalPaymentHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: PaymentGrpcClient, useValue: mockPaymentClient },
                { provide: RegistrationFeeGateService, useValue: mockRegistrationFeeGate },
            ],
        }).compile();

        handler = module.get<ConfirmPortalPaymentHandler>(ConfirmPortalPaymentHandler);
        jest.clearAllMocks();
        // Default: registration fee not yet paid (allow through).
        mockRegistrationFeeGate.isRegistrationFeePaid.mockResolvedValue(false);
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

    it('includes participant dashboard links in payment intent metadata for success emails', async () => {
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
            exchangeRateSnapshot: '17580',
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
                    brandId: 'brand-1',
                    brand: {
                        landingUrl: 'https://program.example.com',
                        websiteUrl: null,
                    },
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
                metadata: expect.objectContaining({
                    payments_page_url: 'https://program.example.com/dashboard/payments',
                    submission_page_url: 'https://program.example.com/dashboard/submission',
                    invoice_url: 'https://program.example.com/dashboard/payments/invoice-1',
                    email: 'hendra@example.com',
                }),
            }),
        );
    });

    // ── duplicate registration-fee guard ──────────────────────────────────────

    const makeRegistrationInvoice = () => ({
        id: 'invoice-reg',
        applicationId: 'app-1',
        amount: '15',
        currency: 'USD',
        amountIdr: null,
        status: 'unpaid',
        exchangeRateSnapshot: '16000',
        paymentMethod: null,
        externalIntentId: null,
        externalTransactionId: null,
        pricingTier: {
            name: 'Registration Fee',
            isActive: true,
            deletedAt: null,
            feeType: 'registration_fee',
        },
        application: {
            participantId: 'participant-1',
            programId: 'program-1',
            program: {
                name: 'China Youth Summit 2026',
                currency: 'USD',
                usdInIdr: '16000',
                brandId: 'brand-1',
                brand: { landingUrl: null, websiteUrl: null },
            },
            participant: {
                fullName: 'Hendra',
                user: { email: 'hendra@example.com' },
            },
        },
    });

    it('throws BadRequestException when the registration fee was already paid on a different invoice', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(makeRegistrationInvoice());
        // Gate reports fee already paid (e.g. via a previously paid invoice).
        mockRegistrationFeeGate.isRegistrationFeePaid.mockResolvedValue(true);

        await expect(
            handler.execute(
                new ConfirmPortalPaymentCommand('user-1', 'invoice-reg', 'gateway', 'xendit_credit_card'),
            ),
        ).rejects.toThrow(new BadRequestException('Registration fee has already been paid.'));

        expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
    });

    it('proceeds normally when the registration fee has not been paid yet', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(makeRegistrationInvoice());
        mockRegistrationFeeGate.isRegistrationFeePaid.mockResolvedValue(false);
        mockPaymentClient.createIntent.mockResolvedValue({ intent_id: 'intent-1' });
        mockPaymentClient.processPayment.mockResolvedValue({
            status: 'PENDING',
            transaction_id: 'tx-1',
            action: { type: 'redirect', url: 'https://checkout.xendit.co/invoice/test' },
        });
        mockPrisma.applicationInvoice.update.mockResolvedValue(undefined);

        const result = await handler.execute(
            new ConfirmPortalPaymentCommand('user-1', 'invoice-reg', 'gateway', 'xendit_credit_card'),
        );

        expect(result).toEqual(
            expect.objectContaining({ invoice_id: 'invoice-reg', intent_id: 'intent-1' }),
        );
        expect(mockPaymentClient.createIntent).toHaveBeenCalledTimes(1);
    });

    it('does NOT call the registration gate for non-registration_fee invoice types', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue({
            ...makeRegistrationInvoice(),
            id: 'invoice-prog',
            pricingTier: {
                name: 'Program Fee',
                isActive: true,
                deletedAt: null,
                feeType: 'program_fee',
            },
        });
        mockPaymentClient.createIntent.mockResolvedValue({ intent_id: 'intent-2' });
        mockPaymentClient.processPayment.mockResolvedValue({
            status: 'PENDING',
            transaction_id: 'tx-2',
            action: { type: 'redirect', url: 'https://checkout.xendit.co/invoice/test2' },
        });
        mockPrisma.applicationInvoice.update.mockResolvedValue(undefined);

        await handler.execute(
            new ConfirmPortalPaymentCommand('user-1', 'invoice-prog', 'gateway', 'xendit_credit_card'),
        );

        expect(mockRegistrationFeeGate.isRegistrationFeePaid).not.toHaveBeenCalled();
        expect(mockPaymentClient.createIntent).toHaveBeenCalledTimes(1);
    });
});
