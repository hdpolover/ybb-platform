// services/api/src/modules/checkout/checkout.handler.ts
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RegisterHandler } from '@modules/auth/application/commands/handlers/register.handler';
import { RegisterCommand } from '@modules/auth/application/commands/register.command';
import { AuthResponseDto } from '@modules/auth/presentation/dto/auth-response.dto';
import { EnsurePortalPaymentInvoiceHandler } from '@modules/portal/application/commands/handlers/ensure-portal-payment-invoice.handler';
import { ConfirmPortalPaymentHandler } from '@modules/portal/application/commands/handlers/confirm-portal-payment.handler';
import {
    ConfirmPortalPaymentCommand,
    EnsurePortalPaymentInvoiceCommand,
} from '@modules/portal/application/queries/portal-queries';
import { CheckoutPolicyService } from './checkout-policy.service';
import { CheckoutGatewayMethodService } from './checkout-gateway-method.service';
import { TurnstileService } from './turnstile.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

export const CHECKOUT_ACCOUNT_EXISTS = 'ACCOUNT_EXISTS';
export const CHECKOUT_CAPTCHA_FAILED = 'CAPTCHA_FAILED';
export const CHECKOUT_PAYMENT_START_FAILED = 'PAYMENT_START_FAILED';

/** Bump when the wording of the terms / privacy / refund notice changes. */
const CONSENT_TYPE = 'checkout_terms_privacy_refund';
const CONSENT_VERSION = '2026-10-28';

export type CheckoutContext = { brandDomain?: string; ip: string; userAgent: string };

export type CheckoutResponse = AuthResponseDto & {
    invoiceId: string | null;
    /** Gateway page to send the browser to; null when the payment could not be started. */
    redirectUrl: string | null;
    /** Present only when the account exists but the payment did not start. */
    code?: typeof CHECKOUT_PAYMENT_START_FAILED;
};

@Injectable()
export class CheckoutHandler {
    private readonly logger = new Logger(CheckoutHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly turnstile: TurnstileService,
        private readonly policy: CheckoutPolicyService,
        private readonly registerHandler: RegisterHandler,
        private readonly ensureInvoice: EnsurePortalPaymentInvoiceHandler,
        private readonly confirmPayment: ConfirmPortalPaymentHandler,
        private readonly gatewayMethod: CheckoutGatewayMethodService,
    ) {}

    async execute(dto: CreateCheckoutDto, ctx: CheckoutContext): Promise<CheckoutResponse> {
        if (this.config.get<string>('CHECKOUT_ENABLED') !== 'true') {
            throw new NotFoundException();
        }
        // Fail closed: a live checkout without a captcha secret is an open account-minting form.
        if (!this.turnstile.isConfigured()) {
            throw new ServiceUnavailableException('Checkout is temporarily unavailable.');
        }
        if (!(await this.turnstile.verify(dto.turnstileToken, ctx.ip))) {
            throw new BadRequestException({ message: 'Captcha verification failed.', code: CHECKOUT_CAPTCHA_FAILED });
        }

        const brandId = await this.policy.resolveBrandId(ctx.brandDomain);
        const offer = await this.policy.resolveOffer({
            brandId,
            programSlug: dto.programSlug,
            tierId: dto.tierId,
            category: dto.category,
        });

        await this.assertNoAccount(dto.email, brandId);

        const session = await this.register(dto, offer, ctx);
        const userId = session.user.id;

        await this.recordConsent(userId, ctx);
        // Onboarding is untouched: only completeOnboarding flips users.is_onboarding_completed.
        await this.saveFullName(userId, dto.fullName);

        let invoiceId: string | null = null;
        try {
            const invoice = await this.ensureInvoice.execute(
                new EnsurePortalPaymentInvoiceCommand(userId, offer.tierId, offer.programId),
            );
            invoiceId = invoice.invoice_id;

            const methodCode = await this.gatewayMethod.resolveCode(offer.programId);
            if (!methodCode) throw new Error('No automatic payment method is available for this program');

            const result = await this.confirmPayment.execute(
                new ConfirmPortalPaymentCommand(userId, invoiceId, 'gateway', methodCode, {
                    callbackUrl: await this.buildCallbackUrl(brandId),
                }),
            );
            const redirectUrl = result.action?.url;
            if (!redirectUrl) throw new Error(`Gateway returned no redirect (status ${result.status})`);

            return { ...session, invoiceId, redirectUrl };
        } catch (error) {
            // The account exists and is logged in: hand back the session so the portal can
            // send them to /dashboard/pay instead of losing them.
            this.logger.error(
                `Checkout payment start failed for user ${userId} invoice ${invoiceId}: ${(error as Error).message}`,
                (error as Error).stack,
            );
            return { ...session, invoiceId, redirectUrl: null, code: CHECKOUT_PAYMENT_START_FAILED };
        }
    }

    private async assertNoAccount(email: string, brandId: string): Promise<void> {
        const existing = await this.prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' }, brandId, deletedAt: null },
            select: { id: true },
        });
        if (existing) throw this.accountExists();
    }

    private accountExists(): ConflictException {
        return new ConflictException({
            message: 'An account with this email already exists. Please sign in.',
            code: CHECKOUT_ACCOUNT_EXISTS,
        });
    }

    private async register(
        dto: CreateCheckoutDto,
        offer: { brandId: string; programSlug: string; category: RegisterCommand['applicationCategory'] },
        ctx: CheckoutContext,
    ): Promise<AuthResponseDto> {
        const provider = await this.prisma.authProvider.findFirst({
            where: { name: 'local', isActive: true },
            select: { id: true },
        });
        if (!provider) throw new ServiceUnavailableException('Checkout is temporarily unavailable.');

        const command = new RegisterCommand(
            dto.email,
            provider.id,
            dto.password,
            offer.brandId,
            undefined,
            undefined,
            offer.programSlug,
            undefined,
            ctx.ip,
            ctx.userAgent,
            offer.category,
            undefined,
            dto.marketingOptIn,
        );
        try {
            // Unchanged register path: creates the user, participant and application and
            // sends the verification email, and does not mark the email verified.
            return await this.registerHandler.execute(command, ctx.brandDomain);
        } catch (error) {
            // Lost a race against a concurrent signup for the same email.
            if (error instanceof ConflictException) throw this.accountExists();
            throw error;
        }
    }

    // Best effort: the account is already created and onboarding collects the name again.
    private async saveFullName(userId: string, fullName: string): Promise<void> {
        try {
            await this.prisma.participant.update({ where: { userId }, data: { fullName } });
        } catch (error) {
            this.logger.error(`Could not save full name for user ${userId}: ${(error as Error).message}`);
        }
    }

    private async recordConsent(userId: string, ctx: CheckoutContext): Promise<void> {
        try {
            await this.prisma.userPrivacyConsent.create({
                data: {
                    userId,
                    consentType: CONSENT_TYPE,
                    consentVersion: CONSENT_VERSION,
                    isGranted: true,
                    grantedAt: new Date(),
                    ipAddress: ctx.ip,
                    userAgent: ctx.userAgent,
                },
            });
        } catch (error) {
            this.logger.error(`Could not record checkout consent for user ${userId}: ${(error as Error).message}`);
        }
    }

    /** The gateway returns the payer to onboarding: only that flow sends a new account on to /dashboard. */
    private async buildCallbackUrl(brandId: string): Promise<string> {
        const brand = await this.prisma.brand.findUnique({
            where: { id: brandId },
            select: { landingUrl: true, websiteUrl: true },
        });
        const base = (brand?.landingUrl ?? brand?.websiteUrl ?? '').trim().replace(/\/+$/, '');
        if (!base) throw new Error(`Brand ${brandId} has no landing or website URL for the payment return`);
        const origin = /^https?:\/\//i.test(base) ? base : `https://${base}`;
        return `${origin}/onboarding?checkout=return`;
    }
}
