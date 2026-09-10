import {
  Injectable,
  NotFoundException,
  BadRequestException,
  PreconditionFailedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { CreateRegistrationPaymentIntentCommand } from '../create-registration-payment-intent.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { resolveUsdInIdrRate } from '@modules/portal/application/utils/resolve-usd-in-idr-rate';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { invalidateParticipantPortalCache } from '@shared/utils/invalidate-participant-portal-cache.util';

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
// Audit M119: statuses that mean "the gateway is still working on this
// intent" - a new intent must not be minted on top of one of these. Mirrors
// GetApplicationHandler.attachPaymentStatus's pending check (PENDING /
// REQUIRES_PAYMENT_METHOD) plus PROCESSING, per PaymentIntent.status's own
// documented value set ("REQUIRES_PAYMENT_METHOD", "PROCESSING", "SUCCEEDED",
// "CANCELED" - see payment.interface.ts). SUCCEEDED/CANCELED are terminal and
// deliberately excluded: a succeeded intent is already covered by the
// isRegistrationFeePaid guard above, and a canceled one should not block a
// fresh attempt.
const IN_FLIGHT_INTENT_STATUSES = new Set(['PENDING', 'REQUIRES_PAYMENT_METHOD', 'PROCESSING']);

@Injectable()
export class CreateRegistrationPaymentIntentHandler {
  private readonly logger = new Logger(CreateRegistrationPaymentIntentHandler.name);

  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly paymentClient: PaymentGrpcClient,
    private readonly prisma: PrismaService,
    private readonly registrationFeeGate: RegistrationFeeGateService,
    private readonly cacheService: CacheService,
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

    // `userId` on this command is a Participant.id (the check above asserts it),
    // which is a DIFFERENT uuid from User.id. The payment service keys intents on
    // users.id and enforces ownership against it (ProcessPayment compares the
    // stored intent's UserID to the caller's), so forwarding a Participant.id
    // here mints an intent the participant can never claim. Resolve the real
    // users.id and pass participant_id separately, exactly as the portal path
    // does (confirm-portal-payment.handler.ts).
    const participant = await this.prisma.participant.findUnique({
      where: { id: application.participantId },
      select: { userId: true },
    });
    if (!participant) {
      throw new NotFoundException(`Participant not found for application ${applicationId}`);
    }

    if (!application.pricingTierId) {
      throw new BadRequestException('No pricing tier selected for this application.');
    }

    // Duplicate-payment guard: reject if registration fee was already paid.
    const alreadyPaid = await this.registrationFeeGate.isRegistrationFeePaid(applicationId);
    if (alreadyPaid) {
      throw new BadRequestException('Registration fee has already been paid.');
    }

    // Duplicate-INTENT guard (audit M119): the check above only catches a
    // registration fee that already SUCCEEDED. Every other call before that -
    // e.g. an admin double-clicking, or retrying after the gateway redirect
    // stalled - used to mint a brand-new intent every time, because this
    // handler has no ApplicationInvoice row to dedupe against the way the
    // portal path does (ConfirmPortalPaymentHandler blocks re-paying an
    // invoice whose status is already 'processing'). There is no invoice here
    // to check, so query the payment service directly for existing intents on
    // this (reference_type, reference_id) pair - the exact same lookup
    // GetApplicationHandler.attachPaymentStatus already makes for this same
    // pair - and reuse an in-flight one instead of creating another.
    //
    // Fails OPEN: if this lookup itself throws (payment service hiccup), fall
    // through to creating a new intent rather than blocking admins from
    // charging registration fees entirely - a spurious duplicate intent is
    // recoverable (refund/cancel); an admin who can never create one is not.
    try {
      const existingIntents = await this.paymentClient.getIntentsByReference({
        reference_type: 'application',
        reference_id: application.id,
      });
      const pendingIntent = (existingIntents?.intents ?? []).find(
        (intent) =>
          IN_FLIGHT_INTENT_STATUSES.has(intent.status) &&
          intent.metadata?.['payment_category'] === 'registration',
      );
      if (pendingIntent) {
        return { intent_id: pendingIntent.id, status: pendingIntent.status };
      }
    } catch (error) {
      this.logger.warn(
        `[create-registration-payment-intent] pending-intent lookup failed for application ${applicationId}, proceeding to create a new intent: ${(error as Error)?.message}`,
      );
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
      user_id: participant.userId,
      participant_id: application.participantId,
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

    // This route (POST /applications/:id/payment-intent) is admin-only, and
    // the @Body('userId') it receives is actually a Participant.id (asserted
    // against application.participantId above), not a users.id — so the
    // (removed) @CacheInvalidate(['portal:*:${userId}']) decorator could
    // never have built a valid portal:*:<usersId> key even before accounting
    // for it resolving to the acting admin's JWT id instead (audit
    // M103/M120). Use the real users.id already resolved above so the
    // participant's portal:payments view picks up the new pending intent
    // instead of serving a stale cached list for the TTL.
    await invalidateParticipantPortalCache(
      this.prisma,
      this.cacheService,
      application.participantId,
      participant.userId,
    );

    return intent;
  }
}
