import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { buildParticipantPaymentsUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { PaymentServiceHttpClient } from './payment-service-http.client';

/**
 * Outcome classification for a single processing invoice, reconciled against the
 * Go payment service (source of truth) rather than the async payment.succeeded
 * event — which can be dropped and leave invoices stuck in 'processing'.
 */
type ReconcileOutcome = 'settled_paid' | 'reverted_unpaid' | 'skipped' | 'error';

interface ReconcileDetail {
    invoiceId: string;
    applicationId: string;
    outcome: ReconcileOutcome;
    reason: string;
}

export interface ReconcileReport {
    scanned: number;
    settledPaid: number;
    revertedUnpaid: number;
    skipped: number;
    errors: number;
    apply: boolean;
    graceMinutes: number;
    details: ReconcileDetail[];
}

export interface ReconcileOptions {
    apply: boolean;
    graceMinutes: number;
}

const PROCESSING_INVOICE_INCLUDE = {
    pricingTier: { select: { feeType: true } },
    application: {
        select: {
            id: true,
            programId: true,
            participant: {
                select: {
                    fullName: true,
                    userId: true,
                    user: { select: { email: true } },
                },
            },
            program: {
                select: {
                    brand: { select: { landingUrl: true, websiteUrl: true } },
                },
            },
        },
    },
} satisfies Prisma.ApplicationInvoiceInclude;

type ProcessingInvoice = Prisma.ApplicationInvoiceGetPayload<{
    include: typeof PROCESSING_INVOICE_INCLUDE;
}>;

@Injectable()
export class PaymentReconciliationService {
    private readonly logger = new Logger(PaymentReconciliationService.name);
    private readonly enabled = parseBool(process.env.ENABLE_PAYMENT_RECONCILIATION, true);
    private readonly batchSize = parsePositiveInt(process.env.PAYMENT_RECONCILIATION_BATCH_SIZE, 200);
    private readonly cronGraceMinutes = parsePositiveInt(
        process.env.PAYMENT_RECONCILIATION_GRACE_MINUTES,
        1440,
    );
    private readonly paymentServiceInternalKey: string;
    private static readonly ABANDONED_CANCEL_REASON = 'Abandoned payment reverted by reconciliation';
    private static readonly RECHECK_INTERVAL_MINUTES = 360;

    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) {
        this.paymentServiceInternalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Hourly safety net. Reconciles 'processing' and 'unpaid' invoices (with
     * external references) against the payment service. Enabled by default.
     */
    @Cron('0 * * * *')
    async runScheduledReconciliation(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        try {
            const report = await this.reconcileProcessingInvoices({
                apply: true,
                graceMinutes: this.cronGraceMinutes,
            });
            this.logger.log(
                `[payment-reconciliation] scanned=${report.scanned} settledPaid=${report.settledPaid} ` +
                `revertedUnpaid=${report.revertedUnpaid} skipped=${report.skipped} errors=${report.errors}`,
            );
        } catch (error) {
            this.logger.error(
                `[payment-reconciliation] scheduled run failed: ${toErrorMessage(error)}`,
            );
        }
    }

    /**
     * Reconcile 'processing' and 'unpaid' invoices that have an external
     * payment reference against the payment service:
     *  - settled at gateway (intent SUCCEEDED / txn SUCCESS) => settle invoice to 'paid'
     *  - abandoned (intent REQUIRES_PAYMENT_METHOD, no success txn) past the grace
     *    window => cancel the gateway intent, revert invoice to 'unpaid', email the
     *    participant a "continue your payment" reminder
     *  - anything else (in-flight, NEEDS_REVIEW, still within grace) => skip
     *
     * Throttled via lastReconciledAt: invoices checked within RECHECK_INTERVAL_MINUTES
     * are skipped unless they have never been reconciled.
     *
     * Idempotent and fail-safe: each invoice is processed in its own try/catch,
     * so one bad invoice or a failed gateway call never aborts the batch. With
     * apply=false it is a pure dry run - no DB writes, no gateway cancels, no emails.
     */
    async reconcileProcessingInvoices(opts: ReconcileOptions): Promise<ReconcileReport> {
        const graceMinutes = Math.max(0, opts.graceMinutes);
        const report: ReconcileReport = {
            scanned: 0,
            settledPaid: 0,
            revertedUnpaid: 0,
            skipped: 0,
            errors: 0,
            apply: opts.apply,
            graceMinutes,
            details: [],
        };

        const invoices = await this.prisma.applicationInvoice.findMany({
            where: {
                status: { in: [PaymentStatus.processing, PaymentStatus.unpaid] },
                AND: [
                    {
                        OR: [
                            { externalIntentId: { not: null } },
                            { externalTransactionId: { not: null } },
                        ],
                    },
                    {
                        OR: [
                            { lastReconciledAt: null },
                            {
                                lastReconciledAt: {
                                    lt: new Date(
                                        Date.now() - PaymentReconciliationService.RECHECK_INTERVAL_MINUTES * 60 * 1000,
                                    ),
                                },
                            },
                        ],
                    },
                ],
            },
            include: PROCESSING_INVOICE_INCLUDE,
            orderBy: [{ lastReconciledAt: 'asc' }, { updatedAt: 'asc' }],
            take: this.batchSize,
        });

        report.scanned = invoices.length;
        const graceCutoff = new Date(Date.now() - graceMinutes * 60_000);

        for (const invoice of invoices) {
            try {
                const detail = await this.reconcileOne(invoice, opts.apply, graceCutoff);
                report.details.push(detail);
                if (detail.outcome === 'settled_paid') report.settledPaid += 1;
                else if (detail.outcome === 'reverted_unpaid') report.revertedUnpaid += 1;
                else report.skipped += 1;
            } catch (error) {
                report.errors += 1;
                const reason = toErrorMessage(error);
                report.details.push({
                    invoiceId: invoice.id,
                    applicationId: invoice.applicationId,
                    outcome: 'error',
                    reason,
                });
                this.logger.error(
                    `[payment-reconciliation] invoice=${invoice.id} failed: ${reason}`,
                );
            }
        }

        return report;
    }

    /**
     * Reconcile invoices for a specific application's registration fee.
     * Called by RegistrationFeeGateService for self-healing on submission.
     */
    async reconcileApplicationRegistration(applicationId: string): Promise<void> {
        const invoices = await this.prisma.applicationInvoice.findMany({
            where: {
                applicationId,
                status: { in: [PaymentStatus.processing, PaymentStatus.unpaid] },
                pricingTier: { feeType: 'registration_fee' },
                OR: [
                    { externalIntentId: { not: null } },
                    { externalTransactionId: { not: null } },
                ],
            },
            include: PROCESSING_INVOICE_INCLUDE,
        });

        const graceCutoff = new Date(Date.now() - this.cronGraceMinutes * 60_000);
        for (const invoice of invoices) {
            try {
                await this.reconcileOne(invoice, true, graceCutoff);
            } catch (error) {
                this.logger.error(
                    `[payment-reconciliation] reconcileApplicationRegistration invoice=${invoice.id} failed: ${toErrorMessage(error)}`,
                );
            }
        }
    }

    private async reconcileOne(
        invoice: ProcessingInvoice,
        apply: boolean,
        graceCutoff: Date,
    ): Promise<ReconcileDetail> {
        // Prefer the intent reference: its payload carries BOTH the intent status
        // (REQUIRES_PAYMENT_METHOD => abandoned) AND the nested transactions[] (any
        // SUCCESS => settled). A transaction-only fetch lacks the intent status, so
        // an abandoned intent whose txn is still PENDING would be misread as
        // in-flight and never reverted. Fall back to the txn id only if no intent.
        const ref =
            (invoice.externalIntentId && invoice.externalIntentId.trim()) ||
            (invoice.externalTransactionId && invoice.externalTransactionId.trim()) ||
            null;

        const base = { invoiceId: invoice.id, applicationId: invoice.applicationId };

        if (!ref) {
            return { ...base, outcome: 'skipped', reason: 'no external payment reference' };
        }

        const payload = await this.fetchPaymentPayload(ref);
        if (payload === null) {
            return { ...base, outcome: 'skipped', reason: 'payment status fetch failed' };
        }

        const originalStatus = invoice.status as string;

        if (this.isPayloadSettled(payload)) {
            const successTxn = this.transactions(payload).find(
                (t) => String(t.status ?? '').toUpperCase() === 'SUCCESS',
            );
            const provenance = {
                transactionId: successTxn ? (String(successTxn.id ?? '') || undefined) : undefined,
                paymentMethod: successTxn
                    ? (String((successTxn as Record<string, unknown>).paymentMethod ?? (successTxn as Record<string, unknown>).payment_method ?? '') || undefined)
                    : undefined,
                // fee_provider / net_amount are always present on a SUCCESS transaction
                // (payment service defaults fee_provider to 0), so these are safe to fill
                // whenever a match is found — see settlePaid's "only if missing" guard.
                feeProvider: successTxn ? toNullableNumber(successTxn.fee_provider) : undefined,
                netAmount: successTxn ? toNullableNumber(successTxn.net_amount) : undefined,
            };
            if (apply) {
                const skipResult = await this.settlePaid(invoice, provenance);
                if (skipResult?.skipped) {
                    return { ...base, outcome: 'skipped', reason: skipResult.reason };
                }
            }
            return { ...base, outcome: 'settled_paid', reason: 'gateway settled' };
        }

        // Not settled - behavior depends on original status
        if (originalStatus === PaymentStatus.unpaid) {
            if (apply) {
                await this.prisma.applicationInvoice.update({
                    where: { id: invoice.id },
                    data: { lastReconciledAt: new Date() },
                });
            }
            return { ...base, outcome: 'skipped', reason: 'unpaid: no successful gateway payment' };
        }

        // processing path
        if (this.isPayloadAbandoned(payload)) {
            if (invoice.updatedAt >= graceCutoff) {
                if (apply) {
                    await this.prisma.applicationInvoice.update({
                        where: { id: invoice.id },
                        data: { lastReconciledAt: new Date() },
                    });
                }
                return { ...base, outcome: 'skipped', reason: 'abandoned but within grace window' };
            }
            if (apply) {
                await this.revertAbandoned(invoice);
                await this.prisma.applicationInvoice.update({
                    where: { id: invoice.id },
                    data: { lastReconciledAt: new Date() },
                });
            }
            return { ...base, outcome: 'reverted_unpaid', reason: 'abandoned past grace window' };
        }

        if (apply) {
            await this.prisma.applicationInvoice.update({
                where: { id: invoice.id },
                data: { lastReconciledAt: new Date() },
            });
        }
        return { ...base, outcome: 'skipped', reason: 'in-flight / needs review' };
    }

    private async fetchPaymentPayload(ref: string): Promise<Record<string, unknown> | null> {
        try {
            const { data } = await this.paymentServiceClient.get(
                `/api/v1/payments/${ref}`,
                { headers: this.buildInternalHeaders() },
            );
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                return {};
            }
            // Payment service may wrap the entity under a `data` key.
            const record = data as Record<string, unknown>;
            if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
                return record.data as Record<string, unknown>;
            }
            return record;
        } catch (error) {
            this.logger.warn(
                `[payment-reconciliation] gateway fetch failed for ${ref}: ${toErrorMessage(error)}`,
            );
            return null;
        }
    }

    /**
     * Settled = intent SUCCEEDED, top-level txn status SUCCESS, or any nested
     * transaction with status SUCCESS.
     */
    private isPayloadSettled(payload: Record<string, unknown>): boolean {
        const top = String(payload.status ?? '').toUpperCase();
        if (top === 'SUCCEEDED' || top === 'SUCCESS') return true;
        return this.transactions(payload).some(
            (t) => String(t.status ?? '').toUpperCase() === 'SUCCESS',
        );
    }

    /**
     * Abandoned = the user opened the gateway but never finished: intent
     * REQUIRES_PAYMENT_METHOD with no transaction that is SUCCESS or NEEDS_REVIEW.
     * NEEDS_REVIEW means a manual transfer whose proof is awaiting admin review -
     * that is pending admin action, NOT abandonment, so we must never auto-revert
     * or cancel it. Only intents whose transactions are all incomplete/dead
     * (PENDING / FAILED / VOID / REJECTED, or none) count as abandoned.
     */
    private isPayloadAbandoned(payload: Record<string, unknown>): boolean {
        const top = String(payload.status ?? '').toUpperCase();
        if (top !== 'REQUIRES_PAYMENT_METHOD') return false;
        const hasBlockingTxn = this.transactions(payload).some((t) => {
            const s = String(t.status ?? '').toUpperCase();
            return s === 'SUCCESS' || s === 'NEEDS_REVIEW';
        });
        return !hasBlockingTxn;
    }

    private transactions(payload: Record<string, unknown>): Array<Record<string, unknown>> {
        const txns = payload.transactions;
        if (!Array.isArray(txns)) return [];
        return txns.filter(
            (t): t is Record<string, unknown> =>
                Boolean(t) && typeof t === 'object' && !Array.isArray(t),
        );
    }

    /**
     * Canonical "settle paid" writes - mirrors processApplicationPayment in
     * payment-events.controller.ts. Idempotent: paidAt keeps any existing value.
     *
     * Includes a supersede guard for registration_fee invoices: if another paid
     * registration_fee invoice already exists for this application, the current
     * invoice is a duplicate payment and must NOT be settled automatically - it
     * needs refund review instead.
     */
    private async settlePaid(
        invoice: ProcessingInvoice,
        provenance?: {
            transactionId?: string;
            paymentMethod?: string;
            feeProvider?: number;
            netAmount?: number;
        },
    ): Promise<{ skipped: true; reason: string } | null> {
        // Supersede guard: prevent double-settling a registration fee
        if (invoice.pricingTier?.feeType === 'registration_fee') {
            const existingPaid = await this.prisma.applicationInvoice.findFirst({
                where: {
                    applicationId: invoice.applicationId,
                    id: { not: invoice.id },
                    pricingTier: { feeType: 'registration_fee' },
                    status: PaymentStatus.paid,
                },
                select: { id: true },
            });
            if (existingPaid) {
                const reason = `Duplicate registration payment: gateway succeeded but superseded by paid invoice ${existingPaid.id}. Needs refund review.`;
                await this.prisma.applicationInvoice.update({
                    where: { id: invoice.id },
                    data: {
                        ...(invoice.rejectionReason ? {} : { rejectionReason: reason }),
                        lastReconciledAt: new Date(),
                    },
                });
                this.logger.warn(
                    `[payment-reconciliation] SUPERSEDE invoice=${invoice.id} superseded by ${existingPaid.id} - needs refund review`,
                );
                return { skipped: true, reason: 'superseded duplicate (needs refund review)' };
            }
        }

        const now = new Date();
        const appPaymentPatch: Prisma.ParticipantApplicationUpdateInput =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: PaymentStatus.paid }
                : { programPaymentStatus: PaymentStatus.paid };

        await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id: invoice.id },
                data: {
                    status: PaymentStatus.paid,
                    paidAt: invoice.paidAt ?? now,
                    ...(provenance?.transactionId && !invoice.externalTransactionId
                        ? { externalTransactionId: provenance.transactionId }
                        : {}),
                    ...(provenance?.paymentMethod && !invoice.paymentMethod
                        ? { paymentMethod: provenance.paymentMethod }
                        : {}),
                    ...(provenance?.feeProvider != null && invoice.feeProvider == null
                        ? { feeProvider: provenance.feeProvider }
                        : {}),
                    ...(provenance?.netAmount != null && invoice.netAmount == null
                        ? { netAmount: provenance.netAmount }
                        : {}),
                    lastReconciledAt: now,
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.applicationId },
                data: appPaymentPatch,
            }),
        ]);

        this.logger.log(`[payment-reconciliation] settled invoice ${invoice.id} -> paid`);
        return null;
    }

    /**
     * Cancel the abandoned gateway intent (tolerating a terminal-400) then revert
     * the invoice + application denorm field to 'unpaid' so the participant can
     * retry, and emit a re-engagement reminder email.
     */
    private async revertAbandoned(invoice: ProcessingInvoice): Promise<void> {
        if (invoice.externalTransactionId?.trim()) {
            await this.cancelGatewayTransaction(invoice.externalTransactionId.trim(), invoice.id);
        }

        const appPaymentPatch: Prisma.ParticipantApplicationUpdateInput =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: PaymentStatus.unpaid }
                : { programPaymentStatus: PaymentStatus.unpaid };

        await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id: invoice.id },
                data: {
                    status: PaymentStatus.unpaid,
                    paidAt: null,
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.applicationId },
                data: appPaymentPatch,
            }),
        ]);

        this.logger.log(`[payment-reconciliation] reverted abandoned invoice ${invoice.id} -> unpaid`);
        await this.emitReminder(invoice);
    }

    /**
     * POST cancel against the payment service. A 400 means the txn is already in a
     * terminal state (SUCCESS/FAILED/REJECTED/VOID) - treat it as already-cancelled,
     * not a hard error, so the revert still proceeds.
     */
    private async cancelGatewayTransaction(transactionId: string, invoiceId: string): Promise<void> {
        try {
            await this.paymentServiceClient.post(
                `/api/v1/payments/${transactionId}/cancel`,
                { reason: PaymentReconciliationService.ABANDONED_CANCEL_REASON },
                { headers: this.buildInternalHeaders() },
            );
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 400) {
                this.logger.warn(
                    `[payment-reconciliation] cancel for invoice ${invoiceId} returned 400 (already terminal) - treating as cancelled`,
                );
                return;
            }
            throw error;
        }
    }

    private async emitReminder(invoice: ProcessingInvoice): Promise<void> {
        const email = invoice.application?.participant?.user?.email;
        if (!email) {
            this.logger.warn(
                `[payment-reconciliation] skipping payment.reminder for invoice ${invoice.id}: participant email not found`,
            );
            return;
        }

        const brand = invoice.application?.program?.brand;
        const paymentsPageUrl = buildParticipantPaymentsUrl(brand);
        if (!paymentsPageUrl) {
            this.logger.warn(
                `[payment-reconciliation] payment.reminder for invoice ${invoice.id} has no paymentsPageUrl: brand.landingUrl/websiteUrl unset`,
            );
        }

        try {
            await this.rabbitmqProducer.emit('payment.reminder', {
                email,
                customer_name: invoice.application?.participant?.fullName ?? 'Participant',
                amount: Number(invoice.amount),
                currency: invoice.currency,
                order_id: invoice.id,
                paymentsPageUrl,
                metadata: {
                    application_id: invoice.applicationId,
                    invoice_id: invoice.id,
                    intent_id: invoice.externalIntentId ?? null,
                },
            });
        } catch (error) {
            // A notification hiccup must not break reconciliation - the invoice is
            // already reverted to 'unpaid', so the participant can still retry.
            this.logger.error(
                `[payment-reconciliation] failed to publish payment.reminder for invoice ${invoice.id}: ${toErrorMessage(error)}`,
            );
        }
    }

    private buildInternalHeaders(): Record<string, string> {
        if (!this.paymentServiceInternalKey) {
            return {};
        }
        return { 'X-Internal-Service-Key': this.paymentServiceInternalKey };
    }
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
}

function toErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}

function toNullableNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}
