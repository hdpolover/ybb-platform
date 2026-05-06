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

function getFeeTypePriority(feeType?: string | null): number {
    const normalized = String(feeType ?? '').toLowerCase();
    if (normalized === 'registration_fee') return 1;
    if (normalized === 'program_fee_1' || normalized === 'full_fee') return 2;
    if (normalized === 'program_fee_2') return 3;
    return 99;
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
                        status: true,
                        paidAt: true,
                        createdAt: true,
                        paymentMethod: true,
                        pricingTierId: true,
                        pricingTier: {
                            select: {
                                id: true,
                                name: true,
                                feeType: true,
                                order: true,
                                isActive: true,
                                deletedAt: true,
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

            // Visibility rule:
            // - tiers are shown in fee-stage order
            // - stop at the first tier that is unpaid/processing/failed/cancelled
            // - do not show future tiers before their start date
            const visibleTierIds = new Set<string>();
            for (const tier of applicableTiers) {
                const invoice = latestInvoiceByTier.get(tier.id);
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
                    const item: PaymentItemDto = {
                        id: invoice.id,
                        title: tier.name,
                        amount: Number(invoice.amount),
                        currency: invoice.currency,
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
                            (normalizedStatus === 'unpaid' || normalizedStatus === 'failed')
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

                availableMethods.push({
                    id: tier.id,
                    title: tier.name,
                    description: tier.description || '',
                    amount: Number(tier.price),
                    currency: tier.currency,
                    type: tier.feeType,
                    startDate: startDate || undefined,
                    dueDate: dueDate || undefined,
                    sequenceOrder,
                });
                totalDue += Number(tier.price);
            }

            // Preserve past invoice records tied to inactive/deleted/out-of-scope tiers.
            // These records should remain visible in participant history, but no new
            // payment should be initiated from them.
            for (const [tierId, invoice] of latestInvoiceByTier.entries()) {
                if (applicableTierIds.has(tierId)) {
                    continue;
                }

                const archivedTier = invoice.pricingTier;
                const archivedPeriods = archivedTier?.validityPeriods ?? [];
                const period = resolveTierPeriod(archivedPeriods, invoice.createdAt, now);
                const normalizedStatus = String(invoice.status).toLowerCase();
                const feeType = archivedTier?.feeType ?? undefined;
                if (feeType === 'registration_fee') {
                    continue;
                }
                const tierOrder = typeof archivedTier?.order === 'number' ? archivedTier.order : 999;
                const sequenceOrder = getFeeTypePriority(feeType) * 1000 + tierOrder;

                const item: PaymentItemDto = {
                    id: invoice.id,
                    title: archivedTier?.name ?? 'Archived Payment Option',
                    amount: Number(invoice.amount),
                    currency: invoice.currency,
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
