// src/modules/payments/presentation/__tests__/payment-admin.controller.override-messaging.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
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

const INVOICE_ID = '11111111-2222-4333-8444-555555555555';
const ADMIN = { userId: 'admin-1' } as never;

// An unpaid invoice with no linked gateway transaction — the case that requires
// a manual override to mark paid.
function invoiceWithNoTransaction() {
    return {
        id: INVOICE_ID,
        status: 'unpaid',
        amount: 1000000,
        currency: 'IDR',
        paymentMethod: 'manual_transfer',
        externalTransactionId: null,
        externalIntentId: null,
        paidAt: null,
        rejectionReason: null,
        verifiedBy: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        pricingTierId: 'tier-1',
        applicationId: 'app-1',
        pricingTier: { feeType: 'registration_fee' },
        application: { id: 'app-1', participant: { userId: 'user-1' } },
    };
}

function buildMockPrisma(invoice: unknown) {
    return {
        $queryRaw: jest.fn().mockResolvedValue([]),
        applicationInvoice: {
            findUnique: jest.fn().mockResolvedValue(invoice),
            // No paid sibling by default - see the supersede guard in updateInvoiceStatus.
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(invoice),
            findMany: jest.fn().mockResolvedValue([]),
        },
        participantApplication: { update: jest.fn().mockResolvedValue({}) },
        // updateInvoiceStatus uses the array form: const [updatedInvoice] = await $transaction([...])
        $transaction: jest.fn().mockImplementation(async (ops: unknown) =>
            Array.isArray(ops) ? ops.map(() => invoice) : [invoice],
        ),
    };
}

async function buildController(mockPrisma: ReturnType<typeof buildMockPrisma>) {
    const module: TestingModule = await Test.createTestingModule({
        controllers: [PaymentAdminController],
        providers: [
            { provide: PaymentServiceHttpClient, useValue: { post: jest.fn() } },
            { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn() } },
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

    return module.get<PaymentAdminController>(PaymentAdminController);
}

describe('PaymentAdminController — admin-facing override messaging', () => {
    let controller: PaymentAdminController;

    beforeEach(async () => {
        controller = await buildController(buildMockPrisma(invoiceWithNoTransaction()));
    });

    async function captureOverrideError() {
        try {
            await controller.updateInvoiceStatus(INVOICE_ID, { status: 'paid' as never }, ADMIN);
            throw new Error('expected updateInvoiceStatus to throw');
        } catch (err) {
            if (!(err instanceof BadRequestException)) throw err;
            return err.getResponse() as { message: string; errorCode?: string };
        }
    }

    it('carries a machine-readable errorCode so the UI can react without matching English', async () => {
        const body = await captureOverrideError();

        expect(body.errorCode).toBe('MANUAL_OVERRIDE_REQUIRED');
    });

    it('does not leak API parameter names into the admin-facing message', async () => {
        const body = await captureOverrideError();

        expect(body.message).not.toMatch(/manualOverride/i);
        expect(body.message).not.toMatch(/overrideReason/i);
        expect(body.message).not.toMatch(/=true/);
    });

    it('explains the situation in plain language', async () => {
        const body = await captureOverrideError();

        expect(body.message).toMatch(/no linked payment transaction/i);
    });

    it('proceeds when the override is supplied with a justification', async () => {
        await expect(
            controller.updateInvoiceStatus(
                INVOICE_ID,
                {
                    status: 'paid' as never,
                    manualOverride: true,
                    overrideReason: 'Bank transfer confirmed manually against statement.',
                },
                ADMIN,
            ),
        ).resolves.toBeDefined();
    });

    it('still rejects an override with a blank justification', async () => {
        await expect(
            controller.updateInvoiceStatus(
                INVOICE_ID,
                { status: 'paid' as never, manualOverride: true, overrideReason: '   ' },
                ADMIN,
            ),
        ).rejects.toThrow(BadRequestException);
    });
});
