import { Test, TestingModule } from '@nestjs/testing';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentServiceHttpClient } from './payment-service-http.client';
import { ConfigService } from '@nestjs/config';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeInvoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'inv-1',
    applicationId: 'app-1',
    pricingTierId: 'tier-1',
    amount: 500000,
    currency: 'IDR',
    status: 'processing',
    paidAt: null,
    externalIntentId: 'intent-1',
    externalTransactionId: null,
    paymentMethod: null,
    rejectionReason: null,
    updatedAt: new Date('2024-01-01'),
    lastReconciledAt: null,
    pricingTier: { feeType: 'registration_fee' },
    application: {
        id: 'app-1',
        programId: 'prog-1',
        participant: { fullName: 'John', userId: 'user-1', user: { email: 'john@test.com' } },
        program: { brand: { landingUrl: 'https://example.com', websiteUrl: null } },
    },
    ...overrides,
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PaymentReconciliationService', () => {
    let service: PaymentReconciliationService;
    let mockPrisma: {
        applicationInvoice: {
            findMany: jest.Mock;
            findFirst: jest.Mock;
            update: jest.Mock;
        };
        participantApplication: {
            update: jest.Mock;
        };
        $transaction: jest.Mock;
    };
    let mockPaymentClient: { get: jest.Mock; post: jest.Mock };
    let mockRabbitmq: { emit: jest.Mock };

    beforeEach(async () => {
        mockPrisma = {
            applicationInvoice: {
                findMany: jest.fn(),
                findFirst: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue({}),
            },
            participantApplication: {
                update: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) =>
                Promise.all(ops),
            ),
        };

        mockPaymentClient = {
            get: jest.fn(),
            post: jest.fn().mockResolvedValue({}),
        };

        mockRabbitmq = {
            emit: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentReconciliationService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
                { provide: RabbitMQProducerService, useValue: mockRabbitmq },
            ],
        }).compile();

        service = module.get<PaymentReconciliationService>(PaymentReconciliationService);
        jest.clearAllMocks();

        // Reset to defaults after clearAllMocks
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);
        mockPrisma.applicationInvoice.update.mockResolvedValue({});
        mockPrisma.participantApplication.update.mockResolvedValue({});
        mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
            Promise.all(ops),
        );
        mockPaymentClient.post.mockResolvedValue({});
        mockRabbitmq.emit.mockResolvedValue(undefined);
    });

    // ── Test case 1: unpaid invoice + gateway SETTLED ─────────────────────────

    describe('unpaid invoice + gateway SETTLED', () => {
        it('settles the invoice and returns outcome settled_paid', async () => {
            const invoice = makeInvoice({ status: 'unpaid', externalIntentId: 'intent-1' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoice]);
            mockPaymentClient.get.mockResolvedValue({
                data: { status: 'SUCCEEDED', transactions: [] },
            });
            // No duplicate registration fee invoice
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);
            mockPrisma.$transaction.mockResolvedValue([{}, {}]);

            const report = await service.reconcileProcessingInvoices({ apply: true, graceMinutes: 1440 });

            expect(report.details[0].outcome).toBe('settled_paid');
            expect(mockPrisma.$transaction).toHaveBeenCalled();
            // Check that applicationInvoice.update was called with lastReconciledAt (inside $transaction via settlePaid)
            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ lastReconciledAt: expect.any(Date) }),
                }),
            );
        });
    });

    // ── Test case 2: unpaid invoice + gateway REQUIRES_PAYMENT_METHOD ─────────

    describe('unpaid invoice + gateway REQUIRES_PAYMENT_METHOD', () => {
        it('skips with reason unpaid: no successful gateway payment, no emit, no $transaction', async () => {
            const invoice = makeInvoice({ status: 'unpaid', externalIntentId: 'intent-1' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoice]);
            mockPaymentClient.get.mockResolvedValue({
                data: { status: 'REQUIRES_PAYMENT_METHOD', transactions: [] },
            });

            const report = await service.reconcileProcessingInvoices({ apply: true, graceMinutes: 1440 });

            expect(report.details[0].outcome).toBe('skipped');
            expect(report.details[0].reason).toContain('unpaid: no successful gateway payment');
            expect(mockRabbitmq.emit).not.toHaveBeenCalled();
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
            // lastReconciledAt still set via direct update
            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ lastReconciledAt: expect.any(Date) }),
                }),
            );
        });
    });

    // ── Test case 3: supersede guard ──────────────────────────────────────────

    describe('supersede guard — unpaid invoice + SETTLED but duplicate registration_fee paid invoice exists', () => {
        it('skips with reason superseded, does NOT call $transaction', async () => {
            const invoice = makeInvoice({
                status: 'unpaid',
                externalIntentId: 'intent-1',
                pricingTier: { feeType: 'registration_fee' },
            });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoice]);
            mockPaymentClient.get.mockResolvedValue({
                data: { status: 'SUCCEEDED', transactions: [] },
            });
            // Duplicate paid registration_fee invoice exists
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue({ id: 'inv-other' });

            const report = await service.reconcileProcessingInvoices({ apply: true, graceMinutes: 1440 });

            expect(report.details[0].outcome).toBe('skipped');
            expect(report.details[0].reason).toContain('superseded');
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });
    });

    // ── Test case 4: processing invoice + past grace + abandoned ─────────────

    describe('processing invoice + past grace + gateway REQUIRES_PAYMENT_METHOD (abandoned)', () => {
        it('reverts to unpaid and calls gateway cancel', async () => {
            // updatedAt way in the past - well outside any grace window
            const invoice = makeInvoice({
                status: 'processing',
                externalIntentId: 'intent-1',
                externalTransactionId: 'txn-1',
                updatedAt: new Date('2020-01-01'),
            });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoice]);
            mockPaymentClient.get.mockResolvedValue({
                data: { status: 'REQUIRES_PAYMENT_METHOD', transactions: [] },
            });
            mockPaymentClient.post.mockResolvedValue({});
            mockPrisma.$transaction.mockResolvedValue([{}, {}]);

            const report = await service.reconcileProcessingInvoices({ apply: true, graceMinutes: 1440 });

            expect(report.details[0].outcome).toBe('reverted_unpaid');
            expect(mockPaymentClient.post).toHaveBeenCalledWith(
                expect.stringContaining('/cancel'),
                expect.anything(),
                expect.anything(),
            );
        });
    });
});
