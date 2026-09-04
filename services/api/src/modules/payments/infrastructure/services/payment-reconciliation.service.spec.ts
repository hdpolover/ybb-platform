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
        participant: {
            fullName: 'John',
            userId: 'user-1',
            deletedAt: null,
            user: { email: 'john@test.com', isActive: true, deletedAt: null },
        },
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

        // Regression for the audit-M158/M65 fix: the old inline guard was keyed on
        // `feeType === 'registration_fee'` exactly, so it never even queried for a
        // programme-fee duplicate - the programPaymentStatus column had no guard
        // at all. findPaidSiblingInvoice widens this to any non-registration fee
        // type sharing the programme column.
        it('also supersedes on a PROGRAMME-fee duplicate (not just registration)', async () => {
            const invoice = makeInvoice({
                status: 'unpaid',
                externalIntentId: 'intent-1',
                pricingTier: { feeType: 'program_fee_1' },
            });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoice]);
            mockPaymentClient.get.mockResolvedValue({
                data: { status: 'SUCCEEDED', transactions: [] },
            });
            // Duplicate paid programme-fee invoice (a different fee type, same column)
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue({ id: 'inv-program-fee-2-paid' });

            const report = await service.reconcileProcessingInvoices({ apply: true, graceMinutes: 1440 });

            expect(report.details[0].outcome).toBe('skipped');
            expect(report.details[0].reason).toContain('superseded');
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: invoice.id },
                    data: expect.objectContaining({
                        rejectionReason: expect.stringContaining('inv-program-fee-2-paid'),
                    }),
                }),
            );
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
            expect(mockRabbitmq.emit).toHaveBeenCalledWith('payment.reminder', expect.anything());
        });

        it('still reverts and cancels for a deactivated participant, but skips the reminder email', async () => {
            const invoice = makeInvoice({
                status: 'processing',
                externalIntentId: 'intent-1',
                externalTransactionId: 'txn-1',
                updatedAt: new Date('2020-01-01'),
                application: {
                    id: 'app-1',
                    programId: 'prog-1',
                    participant: {
                        fullName: 'John',
                        userId: 'user-1',
                        deletedAt: null,
                        user: { email: 'john@test.com', isActive: false, deletedAt: null },
                    },
                    program: { brand: { landingUrl: 'https://example.com', websiteUrl: null } },
                },
            });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoice]);
            mockPaymentClient.get.mockResolvedValue({
                data: { status: 'REQUIRES_PAYMENT_METHOD', transactions: [] },
            });
            mockPaymentClient.post.mockResolvedValue({});
            mockPrisma.$transaction.mockResolvedValue([{}, {}]);

            const report = await service.reconcileProcessingInvoices({ apply: true, graceMinutes: 1440 });

            // The financial state still reconciles regardless of account status.
            expect(report.details[0].outcome).toBe('reverted_unpaid');
            expect(mockPaymentClient.post).toHaveBeenCalledWith(
                expect.stringContaining('/cancel'),
                expect.anything(),
                expect.anything(),
            );
            // But the automated nudge email does not go out.
            expect(mockRabbitmq.emit).not.toHaveBeenCalledWith('payment.reminder', expect.anything());
        });

        // Regression for the audit-M158/M65 fix: program_fee_1 and program_fee_2
        // are different fee types that both write programPaymentStatus. A guard
        // keyed on exact feeType equality (like the old settlePaid) would miss
        // this - only findPaidSiblingInvoice's column-based grouping catches it.
        it('does NOT overwrite the application column and does NOT send a reminder when a paid sibling on the SAME column exists (program_fee_1 paid, program_fee_2 reverted)', async () => {
            const invoice = makeInvoice({
                status: 'processing',
                externalIntentId: 'intent-1',
                externalTransactionId: 'txn-1',
                updatedAt: new Date('2020-01-01'),
                pricingTier: { feeType: 'program_fee_2' },
            });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoice]);
            mockPaymentClient.get.mockResolvedValue({
                data: { status: 'REQUIRES_PAYMENT_METHOD', transactions: [] },
            });
            mockPaymentClient.post.mockResolvedValue({});
            mockPrisma.$transaction.mockResolvedValue([{}, {}]);
            // A different, already-paid invoice (program_fee_1) covers the SAME
            // programPaymentStatus column.
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue({ id: 'inv-program-fee-1-paid' });

            const report = await service.reconcileProcessingInvoices({ apply: true, graceMinutes: 1440 });

            expect(report.details[0].outcome).toBe('reverted_unpaid');
            // The invoice itself still gets reverted to unpaid - that invoice
            // really is abandoned.
            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: invoice.id },
                    data: expect.objectContaining({ status: 'unpaid' }),
                }),
            );
            // But the application-level column must NOT be dragged back to unpaid
            // out from under the already-paid program_fee_1 invoice.
            expect(mockPrisma.participantApplication.update).not.toHaveBeenCalled();
            // And no "please pay" reminder for a program that's already paid.
            expect(mockRabbitmq.emit).not.toHaveBeenCalledWith('payment.reminder', expect.anything());
        });
    });

    // ── Component 2: terminal-invoice drift scan ──────────────────────────────

    describe('reconcileTerminalInvoiceDrift', () => {
        const terminalInvoice = (overrides: Record<string, unknown> = {}) => ({
            id: 'inv-cancelled-1',
            applicationId: 'app-1',
            status: 'cancelled',
            paymentMethod: null,
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
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'voided', detail: 'ok' });

            await service.reconcileTerminalInvoiceDrift(true);

            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-cancelled-1' },
                data: { lastReconciledAt: expect.any(Date) },
            });
        });

        it('never voids and flags danger when the gateway reports SUCCESS, and does NOT stamp lastReconciledAt (must resurface for human review)', async () => {
            // Payload fetch inside reconcileTerminalDriftOne (the pre-void guard) - the
            // top-level status here is irrelevant to the guard as long as no transaction
            // is NEEDS_REVIEW/proof-backed; the settled/danger classification below comes
            // from the separately-mocked voidTransaction call, unchanged.
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'SUCCESS', transactions: [] } });
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('danger_settled');
            expect(report.dangerSettled).toBe(1);
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });

        it('counts a gateway/void error without throwing and does NOT stamp lastReconciledAt (must retry)', async () => {
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'error', detail: 'status fetch failed: timeout' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('error');
            expect(report.errors).toBe(1);
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });

        it('counts an already_terminal outcome as skipped and DOES stamp lastReconciledAt (drift resolved, rotate out)', async () => {
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
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

        it('skips a NEEDS_REVIEW manual-transfer transaction — does NOT void, outcome is skipped_needs_review, does NOT stamp lastReconciledAt', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);
            mockPaymentClient.get.mockResolvedValue({
                data: {
                    status: 'PENDING',
                    transactions: [
                        { status: 'NEEDS_REVIEW', payment_method_id: 'bank_transfer', proof_file_url: 'https://files.example.com/proof.jpg' },
                    ],
                },
            });

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('skipped_needs_review');
            expect(report.needsReview).toBe(1);
            expect(mockGatewayClient.voidTransaction).not.toHaveBeenCalled();
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });

        it('voids a genuinely unpaid, non-review, non-manual-with-proof transaction (existing behavior preserved)', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);
            mockPaymentClient.get.mockResolvedValue({
                data: {
                    status: 'PENDING',
                    transactions: [{ status: 'PENDING', payment_method_id: 'credit_card', proof_file_url: '' }],
                },
            });
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'voided', detail: 'ok' });

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('voided');
            expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', 'inv-cancelled-1', expect.any(String));
        });

        // ── refunded + manual transfer resolution (this fix) ──────────────────

        it('resolves a refunded manual-transfer invoice without calling the gateway, logs no danger, and stamps lastReconciledAt', async () => {
            const errorSpy = jest.spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error');
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([
                terminalInvoice({ status: 'refunded', paymentMethod: 'manual_transfer' }),
            ]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('resolved_refunded_manual');
            expect(report.resolvedRefundedManual).toBe(1);
            expect(report.dangerSettled).toBe(0);
            expect(mockPaymentClient.get).not.toHaveBeenCalled();
            expect(mockGatewayClient.voidTransaction).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
            expect(mockPrisma.applicationInvoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-cancelled-1' },
                data: { lastReconciledAt: expect.any(Date) },
            });
        });

        it('does NOT resolve a refunded manual-transfer invoice in dry-run mode, but still skips the gateway and never writes', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([
                terminalInvoice({ status: 'refunded', paymentMethod: 'manual_transfer' }),
            ]);

            const report = await service.reconcileTerminalInvoiceDrift(false);

            expect(report.details[0].outcome).toBe('resolved_refunded_manual');
            expect(mockPaymentClient.get).not.toHaveBeenCalled();
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });

        it('still flags danger for a refunded CARD invoice whose gateway transaction is still SUCCESS, and does NOT stamp lastReconciledAt', async () => {
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'SUCCESS', transactions: [] } });
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([
                terminalInvoice({ status: 'refunded', paymentMethod: 'credit_card' }),
            ]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('danger_settled');
            expect(report.dangerSettled).toBe(1);
            expect(report.resolvedRefundedManual).toBe(0);
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
        });

        it('regression: a cancelled invoice settled at the gateway still reports danger_settled, unchanged by the refunded-manual fix', async () => {
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'SUCCESS', transactions: [] } });
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([
                terminalInvoice({ status: 'cancelled', paymentMethod: 'manual_transfer' }),
            ]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('danger_settled');
            expect(report.dangerSettled).toBe(1);
            expect(report.resolvedRefundedManual).toBe(0);
            expect(mockPrisma.applicationInvoice.update).not.toHaveBeenCalled();
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
