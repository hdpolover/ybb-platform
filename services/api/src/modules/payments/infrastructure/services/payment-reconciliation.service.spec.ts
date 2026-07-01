import { Test, TestingModule } from '@nestjs/testing';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentServiceHttpClient } from './payment-service-http.client';
import { ConfigService } from '@nestjs/config';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PaymentGatewayClient } from './payment-gateway.client';

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
    let mockGatewayClient: { voidTransaction: jest.Mock };

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

        mockGatewayClient = {
            voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentReconciliationService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
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
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'voided', detail: 'ok' });
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

    // ── Component 2: terminal-invoice drift scan ──────────────────────────────

    describe('reconcileTerminalInvoiceDrift', () => {
        const terminalInvoice = (overrides: Record<string, unknown> = {}) => ({
            id: 'inv-cancelled-1',
            applicationId: 'app-1',
            status: 'cancelled',
            externalTransactionId: 'txn-1',
            externalIntentId: 'intent-1',
            ...overrides,
        });

        it('queries with an ascending lastReconciledAt watermark (nulls first) so unprocessed rows surface first and processed rows rotate to the back', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([]);

            await service.reconcileTerminalInvoiceDrift(true);

            expect(mockPrisma.applicationInvoice.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: [
                        { lastReconciledAt: { sort: 'asc', nulls: 'first' } },
                        { updatedAt: 'asc' },
                    ],
                }),
            );
        });

        it('voids a cancelled invoice whose transaction is still PENDING at the gateway', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('voided');
            expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', 'inv-cancelled-1', expect.any(String));
        });

        it('stamps lastReconciledAt after a voided outcome in apply mode, rotating it out of the watermark window', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'voided', detail: 'ok' });

            await service.reconcileTerminalInvoiceDrift(true);

            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-cancelled-1' },
                data: { lastReconciledAt: expect.any(Date) },
            });
        });

        it('never voids and flags danger when the gateway reports SUCCESS, and does NOT stamp lastReconciledAt (must resurface for human review)', async () => {
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('danger_settled');
            expect(report.dangerSettled).toBe(1);
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });

        it('counts a gateway/void error without throwing and does NOT stamp lastReconciledAt (must retry)', async () => {
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'error', detail: 'status fetch failed: timeout' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('error');
            expect(report.errors).toBe(1);
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });

        it('counts an already_terminal outcome as skipped and DOES stamp lastReconciledAt (drift resolved, rotate out)', async () => {
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'already_terminal', detail: 'transaction already FAILED' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('already_terminal');
            expect(report.skipped).toBe(1);
            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-cancelled-1' },
                data: { lastReconciledAt: expect.any(Date) },
            });
        });

        it('skips invoices with no linked external reference', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([
                terminalInvoice({ externalTransactionId: null, externalIntentId: null }),
            ]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('skipped');
            expect(mockGatewayClient.voidTransaction).not.toHaveBeenCalled();
        });

        it('dry run (apply=false) never calls voidTransaction or applicationInvoice.update', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });

            await service.reconcileTerminalInvoiceDrift(false);

            expect(mockGatewayClient.voidTransaction).not.toHaveBeenCalled();
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });
    });
});
