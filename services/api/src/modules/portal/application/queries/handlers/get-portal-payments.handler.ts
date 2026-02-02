import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetPortalPaymentsQuery } from '../portal-queries';
import { 
    PortalPaymentResponseDto, 
    PaymentItemDto,
    AvailablePaymentDto
} from '../../../presentation/dto/portal-payment.dto';

@Injectable()
@QueryHandler(GetPortalPaymentsQuery)
export class GetPortalPaymentsHandler implements IQueryHandler<GetPortalPaymentsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetPortalPaymentsQuery): Promise<PortalPaymentResponseDto> {
        const { userId } = query;
        const participant = await this.prisma.participant.findUnique({ where: { userId } });
        if (!participant) throw new NotFoundException('Participant not found');

        // Get latest application
        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            include: { invoices: true, program: { include: { pricingTiers: true } } }
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

        return {
            history,
            outstanding,
            availableMethods,
            stats: { totalPaid, totalDue, currency }
        };
    }
}
