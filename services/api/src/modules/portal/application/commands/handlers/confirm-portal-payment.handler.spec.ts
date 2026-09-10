import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { ConfirmPortalPaymentHandler, proofUrlPointsAtFile } from './confirm-portal-payment.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { FileGrpcClient } from '@modules/files/infrastructure/clients/file-grpc-client.service';
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
        invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
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

    const mockFileGrpcClient = {
        getFile: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfirmPortalPaymentHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: PaymentGrpcClient, useValue: mockPaymentClient },
                { provide: FileGrpcClient, useValue: mockFileGrpcClient },
                { provide: RegistrationFeeGateService, useValue: mockRegistrationFeeGate },
            ],
        }).compile();

        handler = module.get<ConfirmPortalPaymentHandler>(ConfirmPortalPaymentHandler);
        jest.clearAllMocks();
        // Default: registration fee not yet paid (allow through).
        mockRegistrationFeeGate.isRegistrationFeePaid.mockResolvedValue(false);
        // Default: the proof file belongs to the caller and its storage_path is
        // embedded in the URL the client submits (matches the 'proof.jpg' fixtures below).
        mockFileGrpcClient.getFile.mockResolvedValue({
            id: 'file-1',
            storage_path: 'proof.jpg',
        });
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

    // M156 backstop: CreateIntentRequest.amount is int64 at the gRPC boundary and
    // silently truncates cents. This should be unreachable via the product now that
    // the admin-facing usdPrice DTO guard exists — it is here to catch a row written
    // by a migration, a script, or a future code path that bypasses the DTO.
    it('rejects a cents-bearing gateway settlement amount with a 400 and never calls the payment client (M156)', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue({
            id: 'invoice-1',
            applicationId: 'app-1',
            amount: '49.99',
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

        await expect(
            handler.execute(new ConfirmPortalPaymentCommand('user-1', 'invoice-1', 'gateway', 'xendit_credit_card')),
        ).rejects.toThrow(BadRequestException);

        expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
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

    // ── manual-payment proof ownership (audit M45) ─────────────────────────────
    // Previously proofFileId/proofFileUrl were forwarded to the payment service
    // verbatim: nothing checked the file belonged to the caller, and nothing
    // checked the URL pointed at our storage at all.

    const makeManualInvoice = () => ({
        id: 'invoice-1',
        applicationId: 'app-1',
        amount: '15',
        currency: 'USD',
        amountIdr: '240000',
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

    it('rejects manual payment when proofFileId is missing, even if proofFileUrl is present', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });

        await expect(
            handler.execute(
                new ConfirmPortalPaymentCommand('user-1', 'invoice-1', 'manual', 'mandiri_gm84xd', {
                    accountName: 'Hendra',
                    sourceName: 'BCA 1234',
                    paymentDate: '2026-05-06',
                    proofFileUrl: 'https://example.com/proof.jpg',
                }),
            ),
        ).rejects.toThrow(BadRequestException);

        // Should fail before ever touching the file service, invoice lookup, or payment intent.
        expect(mockFileGrpcClient.getFile).not.toHaveBeenCalled();
        expect(mockPrisma.applicationInvoice.findUnique).not.toHaveBeenCalled();
        expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
    });

    it('rejects manual payment when the proof file belongs to a different caller', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(makeManualInvoice());
        // The file service collapses "doesn't exist" and "belongs to someone
        // else" into the same NOT_FOUND abort (get_file_handler.py) — simulate
        // that here rather than a domain-specific "forbidden" error.
        const notFoundError = Object.assign(new Error('5 NOT_FOUND: file not found'), {
            code: GrpcStatus.NOT_FOUND,
        });
        mockFileGrpcClient.getFile.mockRejectedValue(notFoundError);

        await expect(
            handler.execute(
                new ConfirmPortalPaymentCommand('user-1', 'invoice-1', 'manual', 'mandiri_gm84xd', {
                    accountName: 'Hendra',
                    sourceName: 'BCA 1234',
                    paymentDate: '2026-05-06',
                    proofFileId: 'someone-elses-file',
                    proofFileUrl: 'https://example.com/proof.jpg',
                }),
            ),
        ).rejects.toThrow(NotFoundException);

        expect(mockFileGrpcClient.getFile).toHaveBeenCalledWith('someone-elses-file', 'user-1', 'brand-1');
        // Never reaches the payment service with an unverified proof.
        expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
        expect(mockPaymentClient.submitManualPayment).not.toHaveBeenCalled();
    });

    it('maps a non-NOT_FOUND file-service failure to 503, not a 500', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(makeManualInvoice());
        const unavailableError = Object.assign(new Error('14 UNAVAILABLE: connection dropped'), {
            code: GrpcStatus.UNAVAILABLE,
        });
        mockFileGrpcClient.getFile.mockRejectedValue(unavailableError);

        await expect(
            handler.execute(
                new ConfirmPortalPaymentCommand('user-1', 'invoice-1', 'manual', 'mandiri_gm84xd', {
                    accountName: 'Hendra',
                    sourceName: 'BCA 1234',
                    paymentDate: '2026-05-06',
                    proofFileId: 'file-1',
                    proofFileUrl: 'https://example.com/proof.jpg',
                }),
            ),
        ).rejects.toThrow(ServiceUnavailableException);
    });

    it('rejects manual payment when the proof URL does not match the verified file', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(makeManualInvoice());
        // Ownership check passes, but the storage_path doesn't appear anywhere
        // in the submitted URL — i.e. the id is legitimately the caller's file,
        // but the URL points somewhere else entirely.
        mockFileGrpcClient.getFile.mockResolvedValue({
            id: 'file-1',
            storage_path: 'dev/brand-1/users/user-1/documents/real-proof.jpg',
        });

        await expect(
            handler.execute(
                new ConfirmPortalPaymentCommand('user-1', 'invoice-1', 'manual', 'mandiri_gm84xd', {
                    accountName: 'Hendra',
                    sourceName: 'BCA 1234',
                    paymentDate: '2026-05-06',
                    proofFileId: 'file-1',
                    proofFileUrl: 'https://evil.example.com/not-the-real-file.jpg',
                }),
            ),
        ).rejects.toThrow(BadRequestException);

        expect(mockPaymentClient.submitManualPayment).not.toHaveBeenCalled();
    });

    it('forwards only the verified proofFileId/proofFileUrl to the payment service on the happy path', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(makeManualInvoice());
        mockFileGrpcClient.getFile.mockResolvedValue({
            id: 'file-1',
            storage_path: 'real-proof.jpg',
        });
        mockPaymentClient.createIntent.mockResolvedValue({ intent_id: 'intent-1' });
        mockPaymentClient.submitManualPayment.mockResolvedValue({ transaction_id: 'tx-manual-1' });
        mockPrisma.applicationInvoice.update.mockResolvedValue(undefined);

        await handler.execute(
            new ConfirmPortalPaymentCommand('user-1', 'invoice-1', 'manual', 'mandiri_gm84xd', {
                accountName: 'Hendra',
                sourceName: 'BCA 1234',
                paymentDate: '2026-05-06',
                proofFileId: 'file-1',
                proofFileUrl: 'https://storage.example.com/path/to/real-proof.jpg',
            }),
        );

        expect(mockFileGrpcClient.getFile).toHaveBeenCalledWith('file-1', 'user-1', 'brand-1');
        expect(mockPaymentClient.submitManualPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                proof_file_id: 'file-1',
                proof_file_url: 'https://storage.example.com/path/to/real-proof.jpg',
            }),
        );
    });
});

// The first version of this guard was `proofFileUrl.includes(storage_path)` over
// the RAW url, which an attacker-hosted URL carrying the real path defeats — and
// that URL is what an admin later opens by hand.
describe('ConfirmPortalPaymentHandler — proof URL must point at the verified file', () => {
    const STORAGE_PATH = 'prod/brandx/users/user-1/documents/proof.pdf';
    const originalStorage = process.env.STORAGE_PUBLIC_URL;
    const originalCdn = process.env.FILE_CDN_HOSTS;

    afterEach(() => {
        if (originalStorage === undefined) delete process.env.STORAGE_PUBLIC_URL;
        else process.env.STORAGE_PUBLIC_URL = originalStorage;
        if (originalCdn === undefined) delete process.env.FILE_CDN_HOSTS;
        else process.env.FILE_CDN_HOSTS = originalCdn;
    });


    it('rejects an attacker-hosted URL that merely CONTAINS the storage path', () => {
        process.env.FILE_CDN_HOSTS = 'cdn.ybbhub.com';
        expect(proofUrlPointsAtFile(`https://evil.example/?x=${STORAGE_PATH}`, STORAGE_PATH)).toBe(false);
        expect(proofUrlPointsAtFile(`https://evil.example/${STORAGE_PATH}`, STORAGE_PATH)).toBe(false);
    });

    // Holds even with the host check inert, which is the state prod ships in today.
    it('rejects a path that carries the storage path only in the query string', () => {
        delete process.env.FILE_CDN_HOSTS;
        expect(proofUrlPointsAtFile(`https://cdn.ybbhub.com/other.pdf?x=${STORAGE_PATH}`, STORAGE_PATH)).toBe(false);
    });

    // The shape actually stored in production, with the host check armed.
    it('accepts the real shape production stores', () => {
        process.env.FILE_CDN_HOSTS = 'cdn.ybbhub.com';
        expect(proofUrlPointsAtFile(`https://cdn.ybbhub.com/${STORAGE_PATH}`, STORAGE_PATH)).toBe(true);
    });

    it('accepts a percent-encoded path', () => {
        process.env.FILE_CDN_HOSTS = 'cdn.ybbhub.com';
        const encoded = `https://cdn.ybbhub.com/${STORAGE_PATH.replace(/\//g, '%2F')}`;
        expect(proofUrlPointsAtFile(encoded, STORAGE_PATH)).toBe(true);
    });

    it('accepts the relative fallback the upload route can return', () => {
        process.env.FILE_CDN_HOSTS = 'cdn.ybbhub.com';
        expect(proofUrlPointsAtFile(`/${STORAGE_PATH}`, STORAGE_PATH)).toBe(true);
    });

    it('rejects a malformed URL rather than throwing', () => {
        expect(proofUrlPointsAtFile('http://[bad', STORAGE_PATH)).toBe(false);
    });
});

// The state production actually deploys in: FILE_CDN_HOSTS unset, so the host
// check is inert. Real payments must still go through — arming it against the
// wrong host would reject all 221 proof URLs on record.
describe('proof URL check is safe to deploy before FILE_CDN_HOSTS is set', () => {
    const STORAGE_PATH = 'prod/brandx/users/user-1/documents/proof.pdf';
    const original = process.env.FILE_CDN_HOSTS;
    const originalStorage = process.env.STORAGE_PUBLIC_URL;

    afterEach(() => {
        if (original === undefined) delete process.env.FILE_CDN_HOSTS;
        else process.env.FILE_CDN_HOSTS = original;
        if (originalStorage === undefined) delete process.env.STORAGE_PUBLIC_URL;
        else process.env.STORAGE_PUBLIC_URL = originalStorage;
    });

    it('accepts the production URL shape while STORAGE_PUBLIC_URL disagrees with it', () => {
        delete process.env.FILE_CDN_HOSTS;
        process.env.STORAGE_PUBLIC_URL = 'https://files.ybbhub.com'; // the prod value
        expect(proofUrlPointsAtFile(`https://cdn.ybbhub.com/${STORAGE_PATH}`, STORAGE_PATH)).toBe(true);
    });
});
