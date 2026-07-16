// services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.verify-guard.spec.ts
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

const MOCK_ADMIN_USER: CurrentUserData = {
    userId: 'admin-1',
    email: 'admin@test.com',
    brandId: 'brand-1',
    role: [],
    adminId: 'admin-id-1',
};

const INVOICE_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

// pricingTier.feeType='program_fee' so a successful reject cascade patches
// programPaymentStatus (not registrationPaymentStatus) on the application.
const buildInvoice = (status: string) => ({
    id: INVOICE_ID,
    amount: 500000,
    currency: 'IDR',
    applicationId: 'app-1',
    status,
    externalTransactionId: 'txn-1',
    pricingTier: { feeType: 'program_fee' },
    application: {
        id: 'app-1',
        participant: {
            fullName: 'John Doe',
            userId: 'user-1',
            user: { email: 'john@example.com' },
        },
        program: { brand: null },
    },
});

describe('PaymentAdminController.verifyInvoice — reject guards', () => {
    let controller: PaymentAdminController;
    let rabbitmqProducer: { emit: jest.Mock };
    let prisma: {
        applicationInvoice: { findUnique: jest.Mock; update: jest.Mock };
        participantApplication: { update: jest.Mock };
        $transaction: jest.Mock;
    };
    let paymentServiceClient: { post: jest.Mock };

    beforeEach(async () => {
        const mockRabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };
        const mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
            },
            participantApplication: {
                update: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
        };
        const mockCache = { invalidateInvoiceCache: jest.fn().mockResolvedValue(undefined) };
        const mockPaymentClient = { post: jest.fn() };
        const mockConfig = { get: jest.fn().mockReturnValue('') };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                {
                    provide: PaymentGatewayClient,
                    useValue: { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) },
                },
                { provide: ConfigService, useValue: mockConfig },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: mockCache },
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
        paymentServiceClient = module.get(PaymentServiceHttpClient);
    });

    it('throws a 400 HttpException and never calls the Go service or writes locally when rejecting an invoice already paid locally', async () => {
        prisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice('paid'));

        let caughtError: HttpException | undefined;
        try {
            await controller.verifyInvoice(
                INVOICE_ID,
                { action: 'reject', reason: 'Duplicate payment' },
                MOCK_ADMIN_USER,
            );
        } catch (error) {
            caughtError = error as HttpException;
        }

        expect(caughtError).toBeInstanceOf(HttpException);
        expect(caughtError?.getStatus()).toBe(400);
        expect(caughtError?.message).toBe('Cannot reject an invoice that is already paid');
        expect(paymentServiceClient.post).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(rabbitmqProducer.emit).not.toHaveBeenCalled();
    });

    it('skips local writes and event publication when the Go service refuses the verify call (fail-closed)', async () => {
        // Local status is 'processing', NOT 'paid' — the new local guard must not
        // fire here. This exercises the pre-existing "Go says no" path: Go's
        // NEEDS_REVIEW guard rejects because the gateway transaction is already
        // SUCCESS, and the local invoice/application must not drift to failed.
        prisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice('processing'));
        paymentServiceClient.post.mockRejectedValue({
            response: { status: 400, data: { message: 'NEEDS_REVIEW: transaction already SUCCESS' } },
        });

        await expect(
            controller.verifyInvoice(INVOICE_ID, { action: 'reject', reason: 'Duplicate payment' }, MOCK_ADMIN_USER),
        ).rejects.toBeInstanceOf(HttpException);

        expect(paymentServiceClient.post).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.applicationInvoice.update).not.toHaveBeenCalled();
        expect(prisma.participantApplication.update).not.toHaveBeenCalled();
        expect(rabbitmqProducer.emit).not.toHaveBeenCalled();
    });

    it('rejects an invoice with local status processing and a successful Go response, cascading invoice and application payment status to failed', async () => {
        prisma.applicationInvoice.findUnique.mockResolvedValue(buildInvoice('processing'));
        paymentServiceClient.post.mockResolvedValue({ data: { success: true } });

        await controller.verifyInvoice(
            INVOICE_ID,
            { action: 'reject', reason: 'Invalid proof' },
            MOCK_ADMIN_USER,
        );

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.applicationInvoice.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: INVOICE_ID },
                data: expect.objectContaining({ status: 'failed' }),
            }),
        );
        expect(prisma.participantApplication.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'app-1' },
                data: expect.objectContaining({ programPaymentStatus: 'failed' }),
            }),
        );
    });
});
