import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
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
        const { userId } = query;

        // Check cache first
        const cacheKey = CACHE_KEYS.PORTAL_PAYMENTS(userId);
        const cached = await this.cacheService.get<PortalPaymentResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        // Cache miss - fetch from database
        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        // Get latest application
        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
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
                        paymentMethod: true,
                        pricingTierId: true
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
                                allowedCategories: true
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

            // 1. Process Invoices
            for (const inv of application.invoices) {
                const item: PaymentItemDto = {
                    id: inv.id,
                    title: 'Registration Fee', // Should fetch from Tier relationship if possible
                    amount: Number(inv.amount),
                    currency: inv.currency,
                    status: inv.status,
                    dueDate: undefined, // Not available in schema
                    paidAt: inv.paidAt || undefined,
                    paymentMethod: inv.paymentMethod || undefined,
                    actionUrl: undefined  // Removed as not in schema
                };

                if (inv.status === 'paid') {
                    history.push(item);
                    totalPaid += Number(inv.amount);
                } else {
                    outstanding.push(item);
                    totalDue += Number(inv.amount);
                }
            }

            // 2. Available Payments (Pricing Tiers that haven't been paid)
            // Filter tiers based on application category
            const applicableTiers = application.program.pricingTiers.filter(t => 
                !application.invoices.some(inv => inv.pricingTierId === t.id && inv.status === 'paid') &&
                (t.allowedCategories.includes(application.applicationCategory as any) || t.allowedCategories.length === 0)
            );

            for (const tier of applicableTiers) {
                availableMethods.push({
                    id: tier.id,
                    title: tier.name,
                    description: tier.description || '',
                    amount: Number(tier.price),
                    currency: tier.currency,
                    type: tier.feeType
                });
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
