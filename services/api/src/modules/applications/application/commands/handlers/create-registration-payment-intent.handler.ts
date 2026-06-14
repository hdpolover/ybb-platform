import {
  Injectable,
  NotFoundException,
  BadRequestException,
  PreconditionFailedException,
  Inject,
} from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { CreateRegistrationPaymentIntentCommand } from '../create-registration-payment-intent.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { resolveUsdInIdrRate } from '@modules/portal/application/utils/resolve-usd-in-idr-rate';

type CreateIntentResponse = Awaited<ReturnType<PaymentGrpcClient['createIntent']>>;

/**
 * Admin path for creating a registration-fee payment intent on behalf of a
 * participant. Participants use the portal flow (EnsurePortalPaymentInvoice +
 * ConfirmPortalPayment). This handler is intentionally amount/pricing-consistent
 * with those handlers:
 * - The fee is resolved from the application's selected pricing tier, but ONLY
 *   when that tier is an active registration_fee tier on the application's
 *   program (fail-closed — a 'registration' intent must never charge a
 *   program_fee/full_fee amount).
 * - Dual pricing: usdPrice is canonical; legacy price/currency is the fallback.
 * - A USD intent requires a configured USD→IDR rate; without it the gateway
 *   returns a cryptic 412 after the intent is already created, so we fail fast.
 */
@Injectable()
export class CreateRegistrationPaymentIntentHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly paymentClient: PaymentGrpcClient,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CreateRegistrationPaymentIntentCommand): Promise<CreateIntentResponse> {
    const { applicationId, userId } = command;

    // 1. Resolve + authorize the application.
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    if (application.participantId !== userId) {
      throw new BadRequestException('Unauthorized to pay for this application');
    }

    if (!application.pricingTierId) {
      throw new BadRequestException('No pricing tier selected for this application.');
    }

    // 2. Resolve the registration fee. The selected tier MUST be an active
    //    registration_fee tier on the application's program — otherwise this
    //    "registration" intent would charge the wrong fee. Fail closed.
    const tier = await this.prisma.programPricingTier.findFirst({
      where: {
        id: application.pricingTierId,
        programId: application.programId,
        isActive: true,
        feeType: 'registration_fee',
      },
      select: { price: true, currency: true, usdPrice: true },
    });

    if (!tier) {
      throw new BadRequestException(
        'No active registration fee tier found for this application.',
      );
    }

    // Dual-pricing snapshot: usdPrice is canonical (USD). Fall back to the
    // legacy price/currency for tiers not yet migrated to dual pricing.
    // Mirrors EnsurePortalPaymentInvoiceHandler.
    const usdSnapshot =
      tier.usdPrice !== null && tier.usdPrice !== undefined ? Number(tier.usdPrice) : null;
    const useDualPricing = usdSnapshot !== null;
    const amount = useDualPricing ? usdSnapshot : Number(tier.price);
    const currency = useDualPricing ? 'USD' : tier.currency || 'IDR';

    if (Number.isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Registration fee amount is invalid.');
    }

    // 3. Exchange-rate snapshot (gateway converts USD intents to IDR). Prefer
    //    the program rate, fall back to the brand setting — same resolution
    //    order as the portal confirm path.
    const program = await this.prisma.program.findUnique({
      where: { id: application.programId },
      select: { usdInIdr: true, brandId: true },
    });

    let exchangeRate = resolveUsdInIdrRate({ programRate: program?.usdInIdr });
    if (exchangeRate === undefined && currency.toUpperCase() === 'USD') {
      const brandSettings = await this.prisma.brandSetting.findFirst({
        where: { brandId: program?.brandId },
        select: { usdInIdr: true },
      });
      exchangeRate = resolveUsdInIdrRate({ programRate: brandSettings?.usdInIdr });
    }

    if (currency.toUpperCase() === 'USD' && exchangeRate === undefined) {
      throw new PreconditionFailedException(
        'Exchange rate (USD → IDR) is not configured for this program. Please contact an administrator to set it up before retrying.',
      );
    }

    // 4. Create the intent via the Payment Service (with exchange-rate snapshot).
    const intent = await this.paymentClient.createIntent({
      user_id: userId,
      amount,
      currency,
      reference_type: 'application',
      reference_id: application.id,
      metadata: {
        payment_category: 'registration',
        program_id: application.programId,
        application_id: application.id,
        ...(exchangeRate !== undefined ? { exchange_rate_value: String(exchangeRate) } : {}),
      },
      exchange_rate: exchangeRate,
    });

    return intent;
  }
}
