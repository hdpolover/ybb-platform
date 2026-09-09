// services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.compare-and-set.spec.ts
//
// M160 (audit 2026-09-02, Correctness: races): updateInvoiceStatus used to
// write applicationInvoice.update({ where: { id } }) with no status
// predicate, so a concurrent payment.succeeded webhook landing between the
// guard read and this write was silently overwritten by the admin's stale
// view. This file pins the compare-and-set fix directly: the write must be
// an updateMany guarded on the status this request actually observed, and a
// lost race (count === 0) must surface as a 409 rather than partially
// applying — or worse, unconditionally applying — an admin override that no
// longer reflects reality.
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
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

describe('PaymentAdminController.updateInvoiceStatus — compare-and-set (M160)', () => {
    let controller: PaymentAdminController;
    let mockGatewayClient: { voidTransaction: jest.Mock };

    // No externalTransactionId — sidesteps the void-guard branch entirely so
    // these tests exercise only the compare-and-set write below it.
    const invoiceRow = {
        id: '33333333-3333-4333-8333-333333333333',
        status: 'processing',
        externalTransactionId: null,
        externalIntentId: null,
        paymentMethod: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        pricingTier: { feeType: 'program_fee_1' },
        application: { id: 'app-3', participant: { userId: 'user-3' } },
    };

    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
        participantApplication: { update: jest.Mock };
        $transaction: jest.Mock;
    };

    async function buildController() {
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

        return module.get<PaymentAdminController>(PaymentAdminController);
    }

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn() };
        mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce(invoiceRow)
                    .mockResolvedValue({ ...invoiceRow, status: 'failed' }),
                findFirst: jest.fn().mockResolvedValue(null),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            participantApplication: { update: jest.fn().mockResolvedValue({}) },
            $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockPrisma)),
        };

        controller = await buildController();
    });

    it('writes via updateMany guarded on the status the pre-write read observed, not a bare where:{id}', async () => {
        await controller.updateInvoiceStatus(
            invoiceRow.id,
            { status: 'failed' as any, reason: 'reconciliation' },
            MOCK_ADMIN,
        );

        expect(mockPrisma.applicationInvoice.updateMany).toHaveBeenCalledWith({
            where: { id: invoiceRow.id, status: 'processing' },
            data: expect.objectContaining({ status: 'failed' }),
        });
    });

    it('uses the interactive $transaction callback form (required so count is known before the participantApplication write)', async () => {
        await controller.updateInvoiceStatus(
            invoiceRow.id,
            { status: 'failed' as any, reason: 'reconciliation' },
            MOCK_ADMIN,
        );

        expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('writes the application payment-status cascade only when the invoice write actually won (count 1)', async () => {
        await controller.updateInvoiceStatus(
            invoiceRow.id,
            { status: 'failed' as any, reason: 'reconciliation' },
            MOCK_ADMIN,
        );

        expect(mockPrisma.participantApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-3' },
            data: { programPaymentStatus: 'failed' },
        });
    });

    it('takes the lost-race path (409, no application write) when updateMany reports count 0', async () => {
        // count 0 means a concurrent writer (e.g. a payment.succeeded webhook)
        // already changed this invoice's status between the guard read and
        // this write — the exact race M160 exists to close.
        mockPrisma.applicationInvoice.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            controller.updateInvoiceStatus(
                invoiceRow.id,
                { status: 'failed' as any, reason: 'reconciliation' },
                MOCK_ADMIN,
            ),
        ).rejects.toBeInstanceOf(HttpException);

        // The application-status cascade must NOT run off a lost race — that
        // is precisely the silent-overwrite bug this fix closes.
        expect(mockPrisma.participantApplication.update).not.toHaveBeenCalled();
    });

    it('reports the lost race as 409 with a machine-readable errorCode', async () => {
        mockPrisma.applicationInvoice.updateMany.mockResolvedValue({ count: 0 });

        try {
            await controller.updateInvoiceStatus(
                invoiceRow.id,
                { status: 'failed' as any, reason: 'reconciliation' },
                MOCK_ADMIN,
            );
            throw new Error('expected updateInvoiceStatus to throw');
        } catch (err) {
            if (!(err instanceof HttpException)) throw err;
            expect(err.getStatus()).toBe(409);
            expect(err.getResponse()).toMatchObject({ errorCode: 'INVOICE_STATUS_CHANGED' });
        }
    });

    it('does not skip the application-column write for a paid-sibling invoice just because the race guard is new (regression: supersede guard still applies)', async () => {
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue({ id: 'sibling-invoice-1' });

        await controller.updateInvoiceStatus(
            invoiceRow.id,
            { status: 'paid' as any, manualOverride: true, overrideReason: 'confirmed' },
            MOCK_ADMIN,
        );

        // Supersede guard (pre-existing, unrelated to M160): a paid sibling
        // means the application column is intentionally left alone even
        // though the invoice write itself won the compare-and-set.
        expect(mockPrisma.participantApplication.update).not.toHaveBeenCalled();
        expect(mockPrisma.applicationInvoice.updateMany).toHaveBeenCalled();
    });
});
