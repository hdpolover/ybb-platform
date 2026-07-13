// services/api/src/modules/payments/infrastructure/services/payment-gateway.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentServiceHttpClient } from './payment-service-http.client';
import {
    extractTopLevelStatus,
    isSettledStatus,
    isTerminalNonSettledStatus,
    isAwaitingReviewStatus,
} from './gateway-transaction-status.util';

export type VoidTransactionOutcome = 'voided' | 'already_terminal' | 'danger_settled' | 'error' | 'needs_review';

export interface VoidTransactionResult {
    outcome: VoidTransactionOutcome;
    detail: string;
}

/**
 * Single, idempotent path for cancelling a Go payment-service transaction. Every
 * writer that moves an invoice to a terminal state (payment.cancelled handler, the
 * portal self-cancel handler, the admin status-override endpoint, the reconciler,
 * and the orphan backfill script) must call this instead of POSTing
 * /cancel directly, so "never void a settled transaction" is enforced in one place.
 */
@Injectable()
export class PaymentGatewayClient {
    private readonly logger = new Logger(PaymentGatewayClient.name);
    private readonly internalKey: string;

    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
    ) {
        this.internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
    }

    async voidTransaction(
        transactionId: string,
        invoiceId: string,
        reason: string,
        // Set by callers that already know (from invoice.paymentMethod on the API
        // side - see PaymentAdminController.isManualPaymentMethod) that this
        // transaction is a manual bank transfer. A manual transfer has no real
        // gateway capture: its SUCCESS status only reflects a prior admin
        // /verify approval, not a live charge, so the settled-block below (and
        // the proof-based awaiting-review fallback) would otherwise wrongly
        // refuse a deliberate admin reversal (paid -> failed/cancelled).
        isManual = false,
    ): Promise<VoidTransactionResult> {
        const headers = this.buildHeaders();

        let payload: Record<string, unknown> | null;
        try {
            payload = await this.fetchTransactionPayload(transactionId, headers);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `[payment-gateway-client] status fetch failed invoice=${invoiceId} txn=${transactionId}, skipping void: ${message}`,
            );
            return { outcome: 'error', detail: `status fetch failed: ${message}` };
        }
        const status = extractTopLevelStatus(payload);
        const settled = isSettledStatus(status);

        if (settled && !isManual) {
            this.logger.error(
                `[payment-gateway-client] DANGER invoice=${invoiceId} txn=${transactionId} is ${status} at gateway, refusing to void`,
            );
            return { outcome: 'danger_settled', detail: `transaction is ${status} at gateway` };
        }

        if (isTerminalNonSettledStatus(status)) {
            return { outcome: 'already_terminal', detail: `transaction already ${status}` };
        }

        // A manual bank-transfer proof is awaiting admin approve/reject via the
        // verify action. The Go service's buildTransactionResponse (GET
        // /api/v1/payments/:id for a transaction) puts proof_file_url and
        // payment_method_id at the top level of the payload alongside status, so
        // we can key on either signal: the status alone (works even if this ID
        // resolves to an intent payload, which doesn't carry proof/method
        // fields), or a non-empty proof_file_url paired with a manual/transfer
        // payment_method_id (belt-and-braces in case status is ever missing or
        // stale). If a future payload shape ever stops exposing proof/method
        // fields, this simply degrades to status-only detection.
        const proofFileUrl = typeof payload?.proof_file_url === 'string' ? payload.proof_file_url : '';
        const paymentMethodId = typeof payload?.payment_method_id === 'string' ? payload.payment_method_id : '';
        const looksLikeManualTransferProof =
            proofFileUrl.length > 0 &&
            (paymentMethodId.toLowerCase().includes('manual') || paymentMethodId.toLowerCase().includes('transfer'));

        // When the caller already confirmed isManual AND the gateway reports this
        // transaction as settled, the proof-based fallback above would otherwise
        // misfire (an approved manual transfer keeps its proof_file_url forever)
        // and re-block the very reversal isManual was passed in for. That
        // fallback exists only to catch a stale/missing status on a still-pending
        // review, which doesn't apply once the primary status signal already says
        // settled.
        const treatAsAwaitingReview =
            isAwaitingReviewStatus(status) || (looksLikeManualTransferProof && !(isManual && settled));

        if (treatAsAwaitingReview) {
            this.logger.warn(
                `[payment-gateway-client] invoice=${invoiceId} txn=${transactionId} is awaiting manual review, refusing to void`,
            );
            return { outcome: 'needs_review', detail: 'transaction is awaiting manual review; refusing to void' };
        }

        try {
            await this.paymentServiceClient.post(
                `/api/v1/payments/${transactionId}/cancel`,
                { reason },
                { headers },
            );
            return { outcome: 'voided', detail: 'transaction cancelled' };
        } catch (error) {
            const httpStatus = (error as { response?: { status?: number } })?.response?.status;
            if (httpStatus === 400) {
                this.logger.warn(
                    `[payment-gateway-client] cancel for invoice ${invoiceId} txn ${transactionId} returned 400 (already terminal)`,
                );
                return { outcome: 'already_terminal', detail: 'gateway returned 400 (already terminal)' };
            }
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `[payment-gateway-client] void failed invoice=${invoiceId} txn=${transactionId}: ${message}`,
            );
            return { outcome: 'error', detail: message };
        }
    }

    // Deliberately does not catch: a fetch failure must be distinguishable from a
    // successful fetch that returns an empty/unknown status. The caller treats a
    // thrown error as "status unknown, do not attempt cancel" and a resolved null
    // as "status genuinely empty, safe to attempt cancel" (see voidTransaction).
    private async fetchTransactionPayload(
        transactionId: string,
        headers: Record<string, string>,
    ): Promise<Record<string, unknown> | null> {
        const { data } = await this.paymentServiceClient.get(
            `/api/v1/payments/${transactionId}`,
            { headers },
        );
        if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
        const record = data as Record<string, unknown>;
        return record.data && typeof record.data === 'object' && !Array.isArray(record.data)
            ? (record.data as Record<string, unknown>)
            : record;
    }

    private buildHeaders(): Record<string, string> {
        return this.internalKey ? { 'X-Internal-Service-Key': this.internalKey } : {};
    }
}
