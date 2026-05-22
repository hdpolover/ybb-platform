import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationCategory } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalPaymentsQuery } from '../portal-queries';
import {
    PortalPaymentResponseDto,
    PaymentItemDto,
    AvailablePaymentDto
} from '../../../presentation/dto/portal-payment.dto';
import { resolveUsdInIdrRate } from '../../utils/resolve-usd-in-idr-rate';

function getFeeTypePriority(feeType?: string | null): number {
    const normalized = String(feeType ?? '').toLowerCase();
    if (normalized === 'registration_fee') return 1;
    if (normalized === 'program_fee_1' || normalized === 'full_fee') return 2;
    if (normalized === 'program_fee_2') return 3;
    return 99;
}

// Implements the same defensive fallback policy as `withDualPriceFallback`
// in `program-content.repository.ts`, with case-insensitive currency matching
// added here for defense against pre-existing rows where currency casing varies.
// Both helpers can be removed in Phase 5 once `usd_price`/`idr_price` become
// NOT NULL columns.
function resolveTierDualPrices(tier: {
    price: { toString(): string } | number;
    currency: string;
    usdPrice: { toString(): string } | number | null | undefined;
    idrPrice: { toString(): string } | number | null | undefined;
}): { usdPrice: number; idrPrice: number } {
    const legacyPrice = Number(tier.price);
    const legacyCurrency = (tier.currency || '').toUpperCase();
    const usdRaw = tier.usdPrice;
    const idrRaw = tier.idrPrice;
    return {
        usdPrice: usdRaw !== null && usdRaw !== undefined
            ? Number(usdRaw)
            : (legacyCurrency === 'USD' ? legacyPrice : 0),
        idrPrice: idrRaw !== null && idrRaw !== undefined
            ? Number(idrRaw)
            : (legacyCurrency === 'IDR' ? legacyPrice : 0),
    };
}

function resolveTierPeriod(
    periods: Array<{ startDate: Date; endDate: Date }>,
    referenceDate: Date,
    now: Date,
): { startDate: Date; endDate: Date } | undefined {
    const byReference = periods.find((period) => period.startDate <= referenceDate && period.endDate >= referenceDate);
    const activeOrUpcoming = periods.find((period) => period.endDate >= now);
    const fallbackLatest = periods.length > 0 ? periods[periods.length - 1] : undefined;
    return byReference ?? activeOrUpcoming ?? fallbackLatest;
}

@Injectable()
@QueryHandler(GetPortalPaymentsQuery)
export class GetPortalPaymentsHandler implements IQueryHandler<GetPortalPaymentsQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(query: GetPortalPaymentsQuery): Promise<PortalPaymentResponseDto> {
        const { userId, programId } = query;

        // Check cache first
        const cacheKey = CACHE_KEYS.PORTAL_PAYMENTS(userId, programId);
        const cached = await this.cacheService.get<PortalPaymentResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        // Cache miss - fetch from database
        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        // Get latest application (filter by programId if provided)
        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id, ...(programId ? { programId } : {}) },
            select: {
                id: true,
                applicationCategory: true,
                invoices: {
                    select: {
                        id: true,
                        amount: true,
                        currency: true,
                        amountUsd: true,
                        amountIdr: true,
                        status: true,
                        paidAt: true,
                        createdAt: true,
                        paymentMethod: true,
                        pricingTierId: true,
                        exchangeRateSnapshot: true,
                        pricingTier: {
                            select: {
                                id: true,
                                name: true,
                                feeType: true,
                                order: true,
                                isActive: true,
                                deletedAt: true,
                                price: true,
                                currency: true,
                                usdPrice: true,
                                idrPrice: true,
                                allowedCategories: true,
                                validityPeriods: {
                                    select: {
                                        startDate: true,
                                        endDate: true,
                                    },
                                    orderBy: { startDate: 'asc' },
                                },
                            }
                        }
                    }
                },
                program: {
                    select: {
                        id: true,
                        currency: true,
                        usdInIdr: true,
                        pricingTiers: {
                            where: {
                                isActive: true,
                                deletedAt: null,
                            },
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                price: true,
                                currency: true,
                                usdPrice: true,
                                idrPrice: true,
                                feeType: true,
                                allowedCategories: true,
                                order: true,
                                validityPeriods: {
                                    select: {
                                        startDate: true,
                                        endDate: true,
                                    },
                                    orderBy: { startDate: 'asc' },
                                },
                            },
                            orderBy: { order: 'asc' }
                        }
                    }
                }
            }
        });

        const history: PaymentItemDto[] = [];
        const outstanding: PaymentItemDto[] = [];
        const availableMethods: AvailablePaymentDto[] = [];
        let totalPaid = 0;
        let totalDue = 0;
        let currency = 'USD';

        if (application) {
            currency = application.program.currency;
            const now = new Date();
            const currentCategory = application.applicationCategory as ApplicationCategory | null;

            // Keep only the newest invoice per tier so a tier appears once with the latest state.
            const latestInvoiceByTier = new Map<string, (typeof application.invoices)[number]>();
            for (const inv of application.invoices) {
                const existing = latestInvoiceByTier.get(inv.pricingTierId);
                if (!existing || inv.createdAt > existing.createdAt) {
                    latestInvoiceByTier.set(inv.pricingTierId, inv);
                }
            }

            const applicableTiers = application.program.pricingTiers
                .filter((tier) => {
                    if (!currentCategory || tier.allowedCategories.length === 0) {
                        return true;
                    }

                    return tier.allowedCategories.includes(currentCategory);
                })
                .sort((a, b) => {
                    const aTypePriority = getFeeTypePriority(a.feeType);
                    const bTypePriority = getFeeTypePriority(b.feeType);
                    if (aTypePriority !== bTypePriority) {
                        return aTypePriority - bTypePriority;
                    }

                    if (a.order !== b.order) {
                        return a.order - b.order;
                    }

                    // Missing start date means "available immediately", so it should not be pushed last.
                    const aStart = a.validityPeriods[0]?.startDate?.getTime() ?? 0;
                    const bStart = b.validityPeriods[0]?.startDate?.getTime() ?? 0;
                    if (aStart !== bStart) {
                        return aStart - bStart;
                    }

                    return a.name.localeCompare(b.name);
                });
            const applicableTierIds = new Set(applicableTiers.map((tier) => tier.id));

            // Build a map of orphan invoices by feeType: invoices whose pricingTier
            // is no longer in `applicableTiers` (because the tier was deactivated,
            // deleted, or excluded after a category switch). These still represent
            // the participant's actual paid/processing state for that fee stage and
            // must not be shadowed by a fresh "available method" entry for the new
            // current tier of the same feeType.
            const orphanInvoicesByFeeType = new Map<string, (typeof application.invoices)[number]>();
            for (const [tierId, invoice] of latestInvoiceByTier.entries()) {
                if (applicableTierIds.has(tierId)) {
                    continue;
                }
                const feeType = invoice.pricingTier?.feeType;
                if (!feeType) {
                    continue;
                }
                const existing = orphanInvoicesByFeeType.get(feeType);
                if (!existing || invoice.createdAt > existing.createdAt) {
                    orphanInvoicesByFeeType.set(feeType, invoice);
                }
            }

            // Visibility rule:
            // - tiers are shown in fee-stage order
            // - stop at the first tier that is unpaid/processing/failed/cancelled
            // - do not show future tiers before their start date
            // - when a previous-tier orphan invoice covers the same feeType, treat
            //   the stage as covered by that orphan (no duplicate available-method
            //   row, and future stages stay locked unless the orphan is paid).
            const visibleTierIds = new Set<string>();
            for (const tier of applicableTiers) {
                const invoice = latestInvoiceByTier.get(tier.id);
                const orphanInvoice = !invoice && tier.feeType
                    ? orphanInvoicesByFeeType.get(tier.feeType)
                    : undefined;

                if (orphanInvoice) {
                    // Orphan covers this stage. The orphan invoice surfaces from the
                    // archived loop below, so we intentionally do not mark this tier
                    // as visible (would otherwise emit a duplicate available-method
                    // row).
                    const orphanStatus = String(orphanInvoice.status).toLowerCase();
                    if (orphanStatus !== 'paid') {
                        break;
                    }
                    continue;
                }

                const period = resolveTierPeriod(tier.validityPeriods, invoice?.createdAt ?? now, now);
                const startDate = period?.startDate;
                const hasStarted = !startDate || startDate <= now;

                if (!hasStarted) {
                    break;
                }

                visibleTierIds.add(tier.id);

                const normalizedStatus = String(invoice?.status ?? 'unpaid').toLowerCase();
                if (normalizedStatus !== 'paid') {
                    break;
                }
            }

            for (const tier of applicableTiers) {
                if (!visibleTierIds.has(tier.id)) {
                    continue;
                }

                const invoice = latestInvoiceByTier.get(tier.id);
                const period = resolveTierPeriod(tier.validityPeriods, invoice?.createdAt ?? now, now);
                const startDate = period?.startDate;
                const dueDate = period?.endDate;
                const sequenceOrder = getFeeTypePriority(tier.feeType) * 1000 + tier.order;

                if (invoice) {
                    const normalizedStatus = String(invoice.status).toLowerCase();
                    const tierPrices = resolveTierDualPrices(tier);
                    // Prefer the invoice's own snapshot — it's frozen at intent
                    // creation. Fall back to the tier only for legacy invoices
                    // that predate the snapshot columns.
                    const usdPrice = invoice.amountUsd !== null && invoice.amountUsd !== undefined
                        ? Number(invoice.amountUsd)
                        : tierPrices.usdPrice;
                    const idrPrice = invoice.amountIdr !== null && invoice.amountIdr !== undefined
                        ? Number(invoice.amountIdr)
                        : tierPrices.idrPrice;
                    const item: PaymentItemDto = {
                        id: invoice.id,
                        title: tier.name,
                        amount: Number(invoice.amount),
                        currency: invoice.currency,
                        usdPrice,
                        idrPrice,
                        exchangeRate: resolveUsdInIdrRate({
                            snapshot: invoice.exchangeRateSnapshot,
                            programRate: application.program?.usdInIdr,
                        }),
                        status: invoice.status,
                        dueDate: dueDate || undefined,
                        paidAt: invoice.paidAt || undefined,
                        paymentMethod: invoice.paymentMethod || undefined,
                        actionUrl: undefined,
                        type: tier.feeType,
                        pricingTierId: tier.id,
                        startDate: startDate || undefined,
                        sequenceOrder,
                        canPay:
                            (
                                normalizedStatus === 'unpaid'
                                || normalizedStatus === 'failed'
                                || normalizedStatus === 'cancelled'
                            )
                            && Number(invoice.amount) > 0,
                    };

                    if (normalizedStatus === 'paid') {
                        history.push(item);
                        totalPaid += Number(invoice.amount);
                    } else {
                        outstanding.push(item);
                        totalDue += Number(invoice.amount);
                    }

                    continue;
                }

                const availableTierPrices = resolveTierDualPrices(tier);
                availableMethods.push({
                    id: tier.id,
                    title: tier.name,
                    description: tier.description || '',
                    amount: Number(tier.price),
                    currency: tier.currency,
                    usdPrice: availableTierPrices.usdPrice,
                    idrPrice: availableTierPrices.idrPrice,
                    exchangeRate: resolveUsdInIdrRate({
                        snapshot: null,
                        programRate: application.program?.usdInIdr,
                    }),
                    type: tier.feeType,
                    startDate: startDate || undefined,
                    dueDate: dueDate || undefined,
                    sequenceOrder,
                });
                totalDue += Number(tier.price);
            }

            // Preserve past invoice records tied to inactive/deleted/out-of-scope tiers.
            // These records should remain visible in participant history (and in the
            // outstanding list when still processing/unpaid), but no new payment
            // should be initiated from them (canPay = false below).
            //
            // Note: the visibility loop above suppresses available-method emission
            // for any currently-applicable tier whose feeType has an orphan invoice
            // here, so surfacing this orphan does not produce a duplicate stage row.
            //
            // Category-scoped visibility rule: when an orphan invoice belongs to a
            // tier whose `allowedCategories` does not include the participant's
            // current `applicationCategory` (i.e. it was created against their
            // previous category), only surface it if its status is `processing` or
            // `paid`. These statuses block category switching and the participant
            // needs to see what's blocking them. Other statuses (unpaid/failed/
            // cancelled) for the old category should be hidden — they're either
            // auto-cancelled on switch or unactionable.
            for (const [tierId, invoice] of latestInvoiceByTier.entries()) {
                if (applicableTierIds.has(tierId)) {
                    continue;
                }

                const archivedTier = invoice.pricingTier;
                const archivedPeriods = archivedTier?.validityPeriods ?? [];
                const period = resolveTierPeriod(archivedPeriods, invoice.createdAt, now);
                const normalizedStatus = String(invoice.status).toLowerCase();

                // Off-category filter: if this orphan belongs to a tier whose
                // allowedCategories excludes the participant's current category,
                // hide it unless it's blocking a switch (processing/paid).
                const archivedAllowedCategories = archivedTier?.allowedCategories ?? [];
                const isOffCategory =
                    currentCategory != null &&
                    archivedAllowedCategories.length > 0 &&
                    !archivedAllowedCategories.includes(currentCategory);
                if (
                    isOffCategory &&
                    normalizedStatus !== 'processing' &&
                    normalizedStatus !== 'paid'
                ) {
                    continue;
                }

                const feeType = archivedTier?.feeType ?? undefined;
                const tierOrder = typeof archivedTier?.order === 'number' ? archivedTier.order : 999;
                const sequenceOrder = getFeeTypePriority(feeType) * 1000 + tierOrder;

                const archivedPrices = archivedTier
                    ? resolveTierDualPrices(archivedTier)
                    : { usdPrice: 0, idrPrice: 0 };
                // Same precedence as the in-scope branch above: invoice snapshot wins.
                const archivedUsdPrice = invoice.amountUsd !== null && invoice.amountUsd !== undefined
                    ? Number(invoice.amountUsd)
                    : (archivedTier ? archivedPrices.usdPrice : undefined);
                const archivedIdrPrice = invoice.amountIdr !== null && invoice.amountIdr !== undefined
                    ? Number(invoice.amountIdr)
                    : (archivedTier ? archivedPrices.idrPrice : undefined);
                const item: PaymentItemDto = {
                    id: invoice.id,
                    title: archivedTier?.name ?? 'Archived Payment Option',
                    amount: Number(invoice.amount),
                    currency: invoice.currency,
                    usdPrice: archivedUsdPrice,
                    idrPrice: archivedIdrPrice,
                    exchangeRate: resolveUsdInIdrRate({
                        snapshot: invoice.exchangeRateSnapshot,
                        programRate: application.program?.usdInIdr,
                    }),
                    status: invoice.status,
                    dueDate: period?.endDate || undefined,
                    paidAt: invoice.paidAt || undefined,
                    paymentMethod: invoice.paymentMethod || undefined,
                    actionUrl: undefined,
                    type: feeType,
                    pricingTierId: archivedTier?.id ?? invoice.pricingTierId,
                    startDate: period?.startDate || undefined,
                    sequenceOrder,
                    canPay: false,
                };

                if (normalizedStatus === 'paid') {
                    history.push(item);
                    totalPaid += Number(invoice.amount);
                } else {
                    outstanding.push(item);
                    totalDue += Number(invoice.amount);
                }
            }
        }

        const result = {
            history,
            outstanding,
            availableMethods,
            stats: { totalPaid, totalDue, currency }
        };

        // Cache the result for 5 minutes
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);

        return result;
    }
}
