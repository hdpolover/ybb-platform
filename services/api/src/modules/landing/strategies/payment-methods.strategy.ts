// services/api/src/modules/landing/strategies/payment-methods.strategy.ts
//
// Public, unauthenticated "which payment methods do you accept" read for the
// marketing site (/fees). Same per-program overlay + global fallback as the
// participant portal (the Go payment service owns that contract), but the
// output is a hard whitelist: name, type, logo. Everything else the Go view
// carries (account numbers, bank details, instructions, gateway config) is
// dropped here and must stay dropped - this route has no auth in front of it.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Brand } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { PaymentServiceHttpClient } from '../../payments/infrastructure/services/payment-service-http.client';
import { fetchOpenRegistrationPrograms } from './registration-editions.util';

export interface PublicPaymentMethod {
  name: string;
  type: string;
  logo_url: string | null;
}

export interface PublicProgramPaymentMethods {
  program_id: string;
  program_slug: string;
  methods: PublicPaymentMethod[];
}

export interface LandingPaymentMethodsData {
  programs: PublicProgramPaymentMethods[];
}

// Only the Go ProgramMethodView fields this strategy reads. Anything else on
// the wire is never touched, so it cannot leak by accident.
interface ProgramMethodViewSubset {
  display_name?: string;
  name?: string;
  type?: string;
  gateway_type?: string;
  icon?: string;
  is_active?: boolean;
  is_enabled?: boolean;
}

export function toPublicPaymentMethod(view: ProgramMethodViewSubset): PublicPaymentMethod | null {
  if (view.is_active === false || view.is_enabled === false) return null;
  const name = (view.display_name || view.name || '').trim();
  if (!name) return null;
  // gateway_type is the user-facing category (bank_transfer, credit_card...)
  // for automatic methods; manual ones only have the master type ("manual").
  const type = (view.gateway_type || view.type || 'other').trim().toLowerCase();
  // `icon` is "URL or identifier" - only pass real URLs/paths to a browser.
  const icon = (view.icon || '').trim();
  const logo_url = /^(https?:\/\/|\/)/i.test(icon) ? icon : null;
  return { name, type, logo_url };
}

@Injectable()
export class PaymentMethodsStrategy {
  private readonly logger = new Logger(PaymentMethodsStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly paymentServiceClient: PaymentServiceHttpClient,
    private readonly configService: ConfigService,
  ) {}

  async getData(brand: Brand | null): Promise<LandingPaymentMethodsData> {
    if (!brand) return { programs: [] };

    const programs = await fetchOpenRegistrationPrograms(this.prisma, this.cacheService, brand.id, new Date());
    const resolved = await Promise.all(
      programs.map(async (program) => ({
        program_id: program.id,
        program_slug: program.slug,
        methods: await this.getProgramMethods(program.id),
      })),
    );
    return { programs: resolved };
  }

  private async getProgramMethods(programId: string): Promise<PublicPaymentMethod[]> {
    const cacheKey = CACHE_KEYS.LANDING_PAYMENT_METHODS(programId);
    const cached = await this.cacheService.get<PublicPaymentMethod[]>(cacheKey);
    if (cached) return cached;

    try {
      const internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
      const headers = internalKey ? { 'X-Internal-Service-Key': internalKey } : {};
      const { data } = await this.paymentServiceClient.get<
        ProgramMethodViewSubset[] | { data?: ProgramMethodViewSubset[] }
      >(`/api/v1/programs/${encodeURIComponent(programId)}/payment-methods`, {
        params: { available_only: true },
        headers,
      });
      const views = Array.isArray(data) ? data : (data?.data ?? []);
      const methods = views
        .map(toPublicPaymentMethod)
        .filter((m): m is PublicPaymentMethod => m !== null);
      await this.cacheService.set(cacheKey, methods, CACHE_TTL.MEDIUM);
      return methods;
    } catch (error) {
      // Public marketing page must not 5xx because the payment service blinked.
      // Not cached, so the next request retries.
      this.logger.warn(`Failed to load public payment methods for program ${programId}: ${(error as Error).message}`);
      return [];
    }
  }
}
