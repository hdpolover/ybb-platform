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

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', invoiceRow.id, expect.any(String), false);
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

    it('passes isManual=true to voidTransaction for a manual_transfer invoice, allowing a settled manual approval to be reversed', async () => {
        const manualInvoice = { ...invoiceRow, status: 'paid', paymentMethod: 'manual_transfer' };
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(manualInvoice);
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'voided', detail: 'ok' });

        await expect(
            controller.updateInvoiceStatus(invoiceRow.id, { status: 'failed' as any, reason: 'reversing approval' }, MOCK_ADMIN),
        ).resolves.toBeDefined();

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', invoiceRow.id, expect.any(String), true);
    });

    it('still throws BadRequestException for a real gateway (non-manual) SUCCESS transaction (danger_settled) — regression guard', async () => {
        const gatewayInvoice = { ...invoiceRow, status: 'paid', paymentMethod: 'xendit_va' };
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(gatewayInvoice);
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });

        await expect(
            controller.updateInvoiceStatus(invoiceRow.id, { status: 'failed' as any, reason: 'oops' }, MOCK_ADMIN),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', invoiceRow.id, expect.any(String), false);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    // Regression: a real Midtrans "bank_transfer"/VA capture contains the substring
    // "transfer" but is NOT a manual approval. isManual must be false so the settled
    // guard stays intact — a substring match here would skip the DANGER block, hit
    // Go's swallowed 400, and drift the local invoice to failed while the gateway
    // stays SUCCESS (un-enrolling a paid participant).
    it('passes isManual=false for a real gateway bank_transfer SUCCESS (must not be treated as manual)', async () => {
        const bankTransferInvoice = { ...invoiceRow, status: 'paid', paymentMethod: 'bank_transfer' };
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue(bankTransferInvoice);
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });

        await expect(
            controller.updateInvoiceStatus(invoiceRow.id, { status: 'failed' as any, reason: 'oops' }, MOCK_ADMIN),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', invoiceRow.id, expect.any(String), false);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});

describe('PaymentAdminController.updateInvoiceStatus — receipt email on non-paid -> paid transition', () => {
    let controller: PaymentAdminController;
    let mockGatewayClient: { voidTransaction: jest.Mock };
    let mockRabbitmq: { emit: jest.Mock };
    let loggerWarnSpy: jest.SpyInstance;
    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock; update: jest.Mock };
        participantApplication: { update: jest.Mock };
        $transaction: jest.Mock;
    };

    const brand = {
        id: 'brand-1',
        name: 'YBB',
        primaryColor: '#000',
        logoUrl: null,
        websiteUrl: 'https://ybb.example',
        landingUrl: 'https://ybb.example',
        contactEmail: null,
        contactAddress: null,
        socialMediaLinks: null,
        settings: { footerNavigation: null, supportEmail: null },
    };

    const baseInvoiceRow = {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'processing',
        externalTransactionId: 'txn-2',
        externalIntentId: 'intent-2',
        amount: 150,
        currency: 'USD',
        applicationId: 'app-2',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        pricingTier: { feeType: 'registration_fee', name: 'Registration Fee' },
        application: { id: 'app-2', participant: { userId: 'user-2' } },
    };

    const buildUpdatedInvoice = (email: string | null) => ({
        ...baseInvoiceRow,
        status: 'paid',
        application: {
            id: 'app-2',
            applicationId: 'app-2',
            participant: {
                fullName: 'Jane Doe',
                userId: 'user-2',
                user: email ? { id: 'user-2', email } : { id: 'user-2', email: null },
            },
            program: { brand },
        },
    });

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
        mockRabbitmq = { emit: jest.fn() };
        mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(baseInvoiceRow),
                update: jest.fn().mockResolvedValue(buildUpdatedInvoice('participant@example.com')),
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
                { provide: RabbitMQProducerService, useValue: mockRabbitmq },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<PaymentAdminController>(PaymentAdminController);
        loggerWarnSpy = jest.spyOn((controller as any).logger, 'warn').mockImplementation(() => undefined);
    });

    it('emits notification.payment_succeeded exactly once on a non-paid -> paid transition, with correct payload fields', async () => {
        await controller.updateInvoiceStatus(
            baseInvoiceRow.id,
            { status: 'paid' as any, manualOverride: true, overrideReason: 'confirmed bank transfer' },
            MOCK_ADMIN,
        );

        expect(mockRabbitmq.emit).toHaveBeenCalledTimes(1);
        expect(mockRabbitmq.emit).toHaveBeenCalledWith(
            'notification.payment_succeeded',
            expect.objectContaining({
                email: 'participant@example.com',
                order_id: baseInvoiceRow.id,
                payment_id: baseInvoiceRow.externalTransactionId,
                amount: baseInvoiceRow.amount,
                currency: baseInvoiceRow.currency,
            }),
        );
    });

    it('emits nothing on a paid -> paid (redundant/no-op) transition', async () => {
        mockPrisma.applicationInvoice.findUnique.mockResolvedValue({ ...baseInvoiceRow, status: 'paid' });

        await controller.updateInvoiceStatus(
            baseInvoiceRow.id,
            { status: 'paid' as any, manualOverride: true, overrideReason: 'no-op re-confirm' },
            MOCK_ADMIN,
        );

        expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    });

    it('does not throw, does not emit, and logs a warn when the participant has no email', async () => {
        mockPrisma.applicationInvoice.update.mockResolvedValue(buildUpdatedInvoice(null));

        await expect(
            controller.updateInvoiceStatus(
                baseInvoiceRow.id,
                { status: 'paid' as any, manualOverride: true, overrideReason: 'confirmed bank transfer' },
                MOCK_ADMIN,
            ),
        ).resolves.toBeDefined();

        expect(mockRabbitmq.emit).not.toHaveBeenCalled();
        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('receipt email skipped'));
    });
});
