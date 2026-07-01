// services/api/src/modules/payments/infrastructure/services/payment-gateway.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentServiceHttpClient } from './payment-service-http.client';
import {
    extractTopLevelStatus,
    isSettledStatus,
    isTerminalNonSettledStatus,
} from './gateway-transaction-status.util';

export type VoidTransactionOutcome = 'voided' | 'already_terminal' | 'danger_settled' | 'error';

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

        if (isSettledStatus(status)) {
            this.logger.error(
                `[payment-gateway-client] DANGER invoice=${invoiceId} txn=${transactionId} is ${status} at gateway, refusing to void`,
            );
            return { outcome: 'danger_settled', detail: `transaction is ${status} at gateway` };
        }

        if (isTerminalNonSettledStatus(status)) {
            return { outcome: 'already_terminal', detail: `transaction already ${status}` };
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
