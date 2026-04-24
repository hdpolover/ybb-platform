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
                                validityPeriods: {
                                    select: {
                                        startDate: true,
                                    },
                                    orderBy: { startDate: 'asc' },
                                    take: 1,
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
                            where: { isActive: true },
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
                                    },
                                    orderBy: { startDate: 'asc' },
                                    take: 1,
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
                    const aStart = a.validityPeriods[0]?.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
                    const bStart = b.validityPeriods[0]?.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
                    if (aStart !== bStart) {
                        return aStart - bStart;
                    }

                    return a.order - b.order;
                });

            // Visibility rule:
            // - tiers are shown in chronological order
            // - stop at the first tier that is unpaid/processing/failed/cancelled
            // - do not show future tiers before their start date
            const visibleTierIds = new Set<string>();
            for (const tier of applicableTiers) {
                const invoice = latestInvoiceByTier.get(tier.id);
                const startDate = tier.validityPeriods[0]?.startDate;
                const hasStarted = !startDate || startDate <= now;

                if (!invoice && !hasStarted) {
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
                const startDate = tier.validityPeriods[0]?.startDate;

                if (invoice) {
                    const item: PaymentItemDto = {
                        id: invoice.id,
                        title: tier.name,
                        amount: Number(invoice.amount),
                        currency: invoice.currency,
                        status: invoice.status,
                        dueDate: undefined,
                        paidAt: invoice.paidAt || undefined,
                        paymentMethod: invoice.paymentMethod || undefined,
                        actionUrl: undefined,
                        type: tier.feeType,
                        pricingTierId: tier.id,
                        startDate: startDate || undefined,
                        sequenceOrder: tier.order,
                    };

                    const normalizedStatus = String(invoice.status).toLowerCase();
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
                    sequenceOrder: tier.order,
                });
                totalDue += Number(tier.price);
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
