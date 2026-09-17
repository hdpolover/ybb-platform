import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ApplicationCategory, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { EnsurePortalPaymentInvoiceCommand } from '../../queries/portal-queries';
import { EnsurePortalPaymentInvoiceResponseDto } from '../../../presentation/dto/portal-payment.dto';
import { resolveUsdInIdrRate } from '../../utils/resolve-usd-in-idr-rate';
import { currentApplicationWhere, currentApplicationOrderBy } from '../../utils/current-application.query';
import { targetFieldsOf } from '@shared/utils/prisma-error.util';
import {
    getRegistrationFeeWindowRejection,
    isRegistrationFeeTierOffCategory,
    REGISTRATION_FEE_CATEGORY_MISMATCH,
    RegistrationFeeWindowInput,
} from '../../utils/registration-fee-window';

/**
 * True when `error` is the P2002 raised by
 * application_invoices_application_tier_unpaid_key (Audit M59/M48 - see the
 * migration for the full predicate rationale) specifically, i.e. two
 * concurrent ensure-invoice calls for the same (applicationId, pricingTierId)
 * both passed the findFirst check above and lost the race to insert first.
 * Any other P2002 is a different constraint and must propagate.
 */
function isDuplicateTierInvoiceConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const fields = targetFieldsOf(error);
    return fields.includes('application_id') && fields.includes('pricing_tier_id');
}

@Injectable()
export class EnsurePortalPaymentInvoiceHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(
        command: EnsurePortalPaymentInvoiceCommand,
    ): Promise<EnsurePortalPaymentInvoiceResponseDto> {
        const { userId, pricingTierId, programId } = command;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) {
            throw new NotFoundException('Participant not found');
        }

        const application = await this.prisma.participantApplication.findFirst({
            where: currentApplicationWhere(participant.id, programId),
            orderBy: currentApplicationOrderBy,
            select: {
                id: true,
                programId: true,
                applicationCategory: true,
                program: {
                    select: {
                        usdInIdr: true,
                        brandId: true,
                        // The category registration window (see
                        // registration-fee-window.ts). Only read for a
                        // registration_fee tier.
                        pricingTiers: {
                            where: { isActive: true, deletedAt: null, feeType: 'registration_fee' },
                            select: {
                                allowedCategories: true,
                                validityPeriods: { select: { startDate: true, endDate: true }, orderBy: { startDate: 'asc' } },
                            },
                        },
                    },
                },
            },
        });

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        const tier = await this.prisma.programPricingTier.findFirst({
            where: {
                id: pricingTierId,
                programId: application.programId,
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                price: true,
                currency: true,
                usdPrice: true,
                idrPrice: true,
                feeType: true,
                allowedCategories: true,
                validityPeriods: { select: { startDate: true, endDate: true }, orderBy: { startDate: 'asc' } },
            },
        });

        if (!tier) {
            throw new NotFoundException('Payment option not found');
        }

        const currentCategory = application.applicationCategory as ApplicationCategory | null;
        const isRegistrationFee = tier.feeType === 'registration_fee';
        const registrationWindow: RegistrationFeeWindowInput = {
            category: currentCategory,
            tier,
            registrationTiers: application.program?.pricingTiers ?? [],
            now: new Date(),
        };

        // A registration_fee tier must belong to the participant's category.
        // Without this a participant could pay a different category's fee -
        // including the (cheaper) Fully Funded fee after Fully Funded closed,
        // by requesting that tier directly.
        //
        // Scoped to categories that HAVE registration tiers of their own. June
        // 2026 made registration_fee payable by every category because the
        // submit gate requires a registration fee from everyone: a category
        // with no tier of its own must still be able to pay the programme's,
        // or it is required-to-pay and forbidden-to-pay at once. That case is
        // left exactly as it was.
        if (isRegistrationFee && isRegistrationFeeTierOffCategory(registrationWindow)) {
            throw new ForbiddenException({
                message: 'This registration fee is for a different category than your application.',
                errorCode: REGISTRATION_FEE_CATEGORY_MISMATCH,
            });
        }

        // For other fee types (full_fee, etc.) the allowedCategories
        // restriction always applies.
        if (
            !isRegistrationFee &&
            currentCategory &&
            tier.allowedCategories.length > 0 &&
            !tier.allowedCategories.includes(currentCategory)
        ) {
            throw new ForbiddenException('This payment option is not available for your current category');
        }

        // A registration_fee is required once and is category-agnostic (the submit
        // gate accepts a paid registration_fee invoice for ANY tier). If the
        // participant already PAID one — possibly for a different category/tier after
        // a switch-category — do not mint a second invoice. Minting one here created
        // a spurious "unpaid" registration_fee invoice (e.g. on already-submitted
        // applications), making paid participants look unpaid. Return the paid one.
        if (isRegistrationFee) {
            const activeRegistrationFee = await this.prisma.applicationInvoice.findFirst({
                where: {
                    applicationId: application.id,
                    status: { in: ['paid', 'processing'] },
                    pricingTier: { feeType: 'registration_fee' },
                },
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            });
            if (activeRegistrationFee) {
                await this.invalidatePortalPaymentCaches(userId, application.programId, activeRegistrationFee.id);
                return {
                    invoice_id: activeRegistrationFee.id,
                    source: 'existing',
                    message: 'Registration fee already paid or in progress',
                };
            }
        }

        const existingInvoice = await this.prisma.applicationInvoice.findFirst({
            where: {
                applicationId: application.id,
                pricingTierId: tier.id,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        if (existingInvoice) {
            await this.invalidatePortalPaymentCaches(userId, application.programId, existingInvoice.id);
            return {
                invoice_id: existingInvoice.id,
                source: 'existing',
                message: 'Invoice is ready',
            };
        }

        // No NEW registration-fee invoice once the category's registration
        // window is not open. Existing invoices are returned above on purpose
        // (detail/receipt pages resolve through here); paying one is refused by
        // ConfirmPortalPaymentHandler under the same rule.
        if (isRegistrationFee) {
            const rejection = getRegistrationFeeWindowRejection(registrationWindow);
            if (rejection) {
                throw new BadRequestException(rejection);
            }
        }

        // Dual-pricing snapshots: prefer the explicit usdPrice/idrPrice fields
        // on the tier when present (admin-curated, locked at invoice creation
        // so later tier edits or FX drift can't retroactively change what the
        // participant owed). Fall back to the legacy `tier.price`/`tier.currency`
        // for tiers not yet migrated to dual-pricing.
        const usdSnapshot = tier.usdPrice !== null && tier.usdPrice !== undefined ? Number(tier.usdPrice) : null;
        const idrSnapshot = tier.idrPrice !== null && tier.idrPrice !== undefined ? Number(tier.idrPrice) : null;

        // Canonical amount/currency for an unpaid invoice: USD if a usdPrice
        // snapshot exists (the new dual-price model treats USD as canonical),
        // otherwise the legacy tier price + currency. On manual confirm the
        // ConfirmPortalPayment handler swaps these to the IDR snapshot.
        const useDualPricing = usdSnapshot !== null;
        const canonicalAmount = useDualPricing ? usdSnapshot : Number(tier.price);
        const canonicalCurrency = useDualPricing ? 'USD' : tier.currency;

        if (Number.isNaN(canonicalAmount) || canonicalAmount < 0) {
            throw new NotFoundException('Payment option amount is invalid');
        }

        let exchangeRateSnapshot = resolveUsdInIdrRate({
            programRate: application.program?.usdInIdr,
        });

        if (exchangeRateSnapshot === undefined && canonicalCurrency.toUpperCase() === 'USD') {
            const brandSettings = await this.prisma.brandSetting.findFirst({
                where: { brandId: application.program?.brandId },
                select: { usdInIdr: true },
            });
            exchangeRateSnapshot = resolveUsdInIdrRate({ programRate: brandSettings?.usdInIdr });
        }

        // Concurrent clicks/tabs both pass the findFirst above and both reach
        // this create — that's the M59/M48 race. The partial unique index
        // application_invoices_application_tier_unpaid_key (application_id,
        // pricing_tier_id) WHERE status IN ('unpaid', 'processing') makes the
        // loser's insert fail with P2002 instead of minting a duplicate row;
        // re-read here and hand the loser the winner's invoice so both callers
        // get the same, single invoice back rather than one of them 500ing.
        let invoice: { id: string };
        try {
            invoice = await this.prisma.applicationInvoice.create({
                data: {
                    applicationId: application.id,
                    pricingTierId: tier.id,
                    amount: canonicalAmount,
                    currency: canonicalCurrency,
                    amountUsd: usdSnapshot,
                    amountIdr: idrSnapshot,
                    status: 'unpaid',
                    exchangeRateSnapshot,
                },
                select: { id: true },
            });
        } catch (error) {
            if (!isDuplicateTierInvoiceConflict(error)) throw error;

            const winner = await this.prisma.applicationInvoice.findFirst({
                where: {
                    applicationId: application.id,
                    pricingTierId: tier.id,
                },
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            });
            if (!winner) throw error;

            await this.invalidatePortalPaymentCaches(userId, application.programId, winner.id);
            return {
                invoice_id: winner.id,
                source: 'existing',
                message: 'Invoice is ready',
            };
        }

        await this.invalidatePortalPaymentCaches(userId, application.programId, invoice.id);

        return {
            invoice_id: invoice.id,
            source: 'created',
            message: `Invoice created for ${tier.name}`,
        };
    }

    private async invalidatePortalPaymentCaches(
        userId: string,
        programId: string,
        invoiceId: string,
    ): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(userId, programId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId)),
            // Minting an invoice changes the dashboard "Total Required"; bust it too
            // so the home card doesn't serve a stale $0.00 for up to the cache TTL.
            // PORTAL_DASHBOARD is keyed by (userId, programId?) - bust both the
            // program-scoped entry and the bare/'latest' one a caller with no
            // programId would still be serving.
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(userId, programId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(userId)),
        ]);
    }
}
