// services/api/src/modules/checkout/checkout-gateway-method.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentServiceHttpClient } from '@modules/payments/infrastructure/services/payment-service-http.client';

type MethodRow = { code: string; type?: string; is_active?: boolean };

/**
 * The code of the program's first automatic (gateway) payment method, resolved
 * the way the portal's payment page does: the program-merged list, falling back
 * to the global list when that call fails. Checkout never offers manual transfer.
 */
@Injectable()
export class CheckoutGatewayMethodService {
    constructor(
        private readonly http: PaymentServiceHttpClient,
        private readonly config: ConfigService,
    ) {}

    async resolveCode(programId: string): Promise<string | null> {
        const key = this.config.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
        const headers: Record<string, string> = key ? { 'X-Internal-Service-Key': key } : {};

        let methods: MethodRow[];
        try {
            methods = await this.fetch(`/api/v1/programs/${encodeURIComponent(programId)}/payment-methods`, { available_only: true }, headers);
        } catch {
            methods = await this.fetch('/api/v1/payment-methods', { is_active: true, available_only: true }, headers);
        }
        return methods.find((m) => m.type?.toLowerCase() === 'automatic' && m.is_active !== false)?.code ?? null;
    }

    private async fetch(path: string, params: Record<string, unknown>, headers: Record<string, string>): Promise<MethodRow[]> {
        const { data } = await this.http.get<MethodRow[] | { data?: MethodRow[] }>(path, { params, headers });
        return Array.isArray(data) ? data : (data?.data ?? []);
    }
}
