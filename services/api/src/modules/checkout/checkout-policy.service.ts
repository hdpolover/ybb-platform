// services/api/src/modules/checkout/checkout-policy.service.ts
import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationCategory, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { isProgramRegistrationOpen } from '@modules/auth/application/services/auth-program-linking.util';
import { resolveUsdInIdrRate } from '@modules/portal/application/utils/resolve-usd-in-idr-rate';
import {
    getRegistrationFeeWindowRejection,
    isRegistrationFeeTierOffCategory,
    REGISTRATION_FEE_CATEGORY_MISMATCH,
    RegistrationFeeWindowInput,
} from '@modules/portal/application/utils/registration-fee-window';

export const CHECKOUT_PROGRAM_CLOSED = 'CHECKOUT_PROGRAM_CLOSED';
export const CHECKOUT_CATEGORY_REQUIRED = 'CHECKOUT_CATEGORY_REQUIRED';
export const CHECKOUT_AMOUNT_INVALID = 'CHECKOUT_AMOUNT_INVALID';

export type ResolveOfferInput = {
    brandId: string;
    /** Exactly one of programId / programSlug identifies the program. */
    programId?: string;
    programSlug?: string;
    tierId: string;
    /** Optional only when the tier allows exactly one category. */
    category?: ApplicationCategory;
};

/**
 * What a checkout may charge, resolved entirely from the DB. Never built from
 * client-supplied amounts. Amount rules mirror ensure-portal-payment-invoice.handler.ts:
 * USD is canonical when the tier has a usdPrice, otherwise the legacy price/currency.
 */
export type CheckoutOffer = {
    brandId: string;
    programId: string;
    programName: string;
    programSlug: string;
    tierId: string;
    tierName: string;
    category: ApplicationCategory;
    amount: number;
    currency: string;
    amountUsd: number | null;
    amountIdr: number | null;
    /** IDR per USD, only resolved for a USD-denominated offer. */
    exchangeRate: number | undefined;
};

export type CheckoutOption = {
    category: ApplicationCategory;
    tierId: string;
    tierName: string;
    amount: number;
    currency: string;
    amountIdr?: number;
};

export type CheckoutEdition = {
    programSlug: string;
    programName: string;
    registrationDates: { open: string | null; close: string | null };
    options: CheckoutOption[];
};

// An empty allowedCategories list reads as "every category" (see isRegistrationFeeTierOffCategory).
const ALL_CATEGORIES: readonly ApplicationCategory[] = ['fully_funded', 'self_funded'];

const PROGRAM_SELECT = {
    id: true,
    name: true,
    slug: true,
    status: true,
    isPublished: true,
    isActive: true,
    allowRegistration: true,
    registrationOpenDate: true,
    registrationCloseDate: true,
    usdInIdr: true,
    pricingTiers: {
        where: { isActive: true, deletedAt: null, feeType: 'registration_fee' },
        orderBy: { order: 'asc' },
        select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            usdPrice: true,
            idrPrice: true,
            feeType: true,
            isActive: true,
            deletedAt: true,
            allowedCategories: true,
            validityPeriods: { select: { startDate: true, endDate: true }, orderBy: { startDate: 'asc' } },
        },
    },
} satisfies Prisma.ProgramSelect;

type ProgramRow = Prisma.ProgramGetPayload<{ select: typeof PROGRAM_SELECT }>;

@Injectable()
export class CheckoutPolicyService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Same lookup the auth flows use, minus their "no domain means default brand"
     * fallback: a checkout that cannot tell which brand it is for must refuse.
     */
    async resolveBrandId(domain: string | undefined): Promise<string> {
        if (!domain) {
            throw new BadRequestException('Brand could not be determined for this request.');
        }
        const brand =
            (await this.prisma.brand.findFirst({
                where: { websiteUrl: domain, isActive: true },
                select: { id: true },
            })) ??
            (await this.prisma.brand.findFirst({
                where: { websiteUrl: { contains: domain, mode: 'insensitive' }, isActive: true },
                select: { id: true },
            }));
        if (!brand) {
            throw new BadRequestException('Brand could not be determined for this request.');
        }
        return brand.id;
    }

    async resolveOffer(input: ResolveOfferInput): Promise<CheckoutOffer> {
        const { brandId, programId, programSlug, tierId } = input;
        const now = new Date();

        if (!programId && !programSlug) {
            throw new BadRequestException('programId or programSlug is required');
        }

        // brandId is part of the lookup, so another brand's program is simply "not found".
        const program = await this.prisma.program.findFirst({
            where: { brandId, ...(programId ? { id: programId } : { slug: programSlug }) },
            select: PROGRAM_SELECT,
        });
        if (!program) {
            throw new NotFoundException('Program not found');
        }

        // pricingTiers is already filtered to active, non-deleted registration_fee
        // tiers, so a hit here means the tier belongs to this program AND qualifies.
        const tier = program.pricingTiers.find((t) => t.id === tierId);
        if (!tier) {
            throw new NotFoundException('Payment option not found');
        }

        const offer = this.evaluate(brandId, program, tier, input.category ?? this.singleCategory(tier.allowedCategories), now);

        let exchangeRate = resolveUsdInIdrRate({ programRate: program.usdInIdr });
        if (exchangeRate === undefined && offer.currency.toUpperCase() === 'USD') {
            const brandSettings = await this.prisma.brandSetting.findFirst({
                where: { brandId },
                select: { usdInIdr: true },
            });
            exchangeRate = resolveUsdInIdrRate({ programRate: brandSettings?.usdInIdr });
        }
        return { ...offer, exchangeRate };
    }

    /**
     * Every valid (edition, category, tier) the brand can sell right now: open
     * programs only, and per option the same checks resolveOffer applies. An
     * option that would be rejected is left out rather than reported. Skips the
     * brand-setting FX lookup (listing needs no rate); resolveOffer supplies it.
     */
    async listOffers(brandId: string): Promise<CheckoutEdition[]> {
        const now = new Date();
        const programs = await this.prisma.program.findMany({
            where: {
                brandId,
                status: 'published',
                isPublished: true,
                isActive: true,
                allowRegistration: true,
            },
            orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
            select: PROGRAM_SELECT,
        });

        const editions: CheckoutEdition[] = [];
        for (const program of programs) {
            if (!isProgramRegistrationOpen(program, now)) continue;
            const options: CheckoutOption[] = [];
            for (const tier of program.pricingTiers) {
                const categories = tier.allowedCategories.length > 0 ? tier.allowedCategories : ALL_CATEGORIES;
                for (const category of categories) {
                    try {
                        const o = this.evaluate(brandId, program, tier, category, now);
                        options.push({
                            category: o.category,
                            tierId: o.tierId,
                            tierName: o.tierName,
                            amount: o.amount,
                            currency: o.currency,
                            ...(o.amountIdr !== null ? { amountIdr: o.amountIdr } : {}),
                        });
                    } catch (error) {
                        if (!(error instanceof HttpException)) throw error;
                    }
                }
            }
            if (options.length === 0) continue;
            editions.push({
                programSlug: program.slug,
                programName: program.name,
                registrationDates: {
                    open: program.registrationOpenDate?.toISOString() ?? null,
                    close: program.registrationCloseDate?.toISOString() ?? null,
                },
                options,
            });
        }
        return editions;
    }

    /** The authoritative checks for one tier + category; throws HttpException on any rejection. */
    private evaluate(
        brandId: string,
        program: ProgramRow,
        tier: ProgramRow['pricingTiers'][number],
        category: ApplicationCategory,
        now: Date,
    ): Omit<CheckoutOffer, 'exchangeRate'> {
        if (!isProgramRegistrationOpen(program, now)) {
            throw new BadRequestException({
                message: 'Registration for this program is not open.',
                errorCode: CHECKOUT_PROGRAM_CLOSED,
            });
        }

        const registrationWindow: RegistrationFeeWindowInput = {
            category,
            tier,
            registrationTiers: program.pricingTiers,
            now,
        };
        if (isRegistrationFeeTierOffCategory(registrationWindow)) {
            throw new BadRequestException({
                message: 'This registration fee is for a different category.',
                errorCode: REGISTRATION_FEE_CATEGORY_MISMATCH,
            });
        }
        const rejection = getRegistrationFeeWindowRejection(registrationWindow);
        if (rejection) {
            throw new BadRequestException(rejection);
        }

        const usdSnapshot = tier.usdPrice != null ? Number(tier.usdPrice) : null;
        const idrSnapshot = tier.idrPrice != null ? Number(tier.idrPrice) : null;
        const useDualPricing = usdSnapshot !== null;
        const amount = useDualPricing ? usdSnapshot : Number(tier.price);
        const currency = useDualPricing ? 'USD' : tier.currency;

        // A checkout charges money: unlike the portal invoice path, a zero amount is refused.
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new BadRequestException({
                message: 'Payment option amount is invalid.',
                errorCode: CHECKOUT_AMOUNT_INVALID,
            });
        }

        return {
            brandId,
            programId: program.id,
            programName: program.name,
            programSlug: program.slug,
            tierId: tier.id,
            tierName: tier.name,
            category,
            amount,
            currency,
            amountUsd: usdSnapshot,
            amountIdr: idrSnapshot,
        };
    }

    private singleCategory(allowed: readonly ApplicationCategory[]): ApplicationCategory {
        if (allowed.length === 1) return allowed[0];
        throw new BadRequestException({
            message: 'A category is required for this registration fee.',
            errorCode: CHECKOUT_CATEGORY_REQUIRED,
        });
    }
}
