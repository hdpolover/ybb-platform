import { Injectable, Logger } from '@nestjs/common';
import { PaymentServiceHttpClient } from '@modules/payments/infrastructure/services/payment-service-http.client';

export interface PaymentMethodSummary {
  enabledCount: number;
  /** True when the program has at least one overlay row of its own. */
  isConfigured: boolean;
}

interface ProgramMethodView {
  is_enabled?: boolean;
  is_configured?: boolean;
}

// Readiness pages must not hang on a slow payment service. Three seconds is
// well past a healthy response and well short of an admin giving up.
const TIMEOUT_MS = 3000;

@Injectable()
export class PaymentConfigClient {
  private readonly logger = new Logger(PaymentConfigClient.name);

  constructor(private readonly http: PaymentServiceHttpClient) {}

  // Returns null when the answer is genuinely unknown. The caller turns that
  // into an 'unknown' rule status; it must never become a passing rule, which
  // is how a down service would otherwise wave a broken program into
  // production.
  async getProgramMethodSummary(programId: string): Promise<PaymentMethodSummary | null> {
    try {
      // include_disabled gives the admin view: every active master method with
      // is_enabled reflecting this program's choice. Without it the response is
      // the merged participant view, where master fallbacks are
      // indistinguishable from real per-program config.
      const response = await this.http.get<{ data: ProgramMethodView[] }>(
        `/programs/${programId}/payment-methods?include_disabled=true`,
        { timeout: TIMEOUT_MS },
      );

      const views = response?.data?.data;
      if (!Array.isArray(views)) {
        this.logger.warn(`Unexpected payment-method payload for program ${programId}`);
        return null;
      }

      return {
        enabledCount: views.filter((v) => v.is_enabled === true).length,
        isConfigured: views.some((v) => v.is_configured === true),
      };
    } catch (error) {
      this.logger.warn(
        `Payment service unreachable for program ${programId}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
