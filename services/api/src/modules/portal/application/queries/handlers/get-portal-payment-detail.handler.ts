import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalPaymentDetailQuery } from '../portal-queries';
import {
    PortalPaymentDetailResponseDto,
    PaymentHistoryEntryDto,
} from '../../../presentation/dto/portal-payment.dto';

@Injectable()
@QueryHandler(GetPortalPaymentDetailQuery)
export class GetPortalPaymentDetailHandler implements IQueryHandler<GetPortalPaymentDetailQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(query: GetPortalPaymentDetailQuery): Promise<PortalPaymentDetailResponseDto> {
        const { userId, invoiceId } = query;

        const cacheKey = CACHE_KEYS.PORTAL_PAYMENT_DETAIL(invoiceId);
        const cached = await this.cacheService.get<PortalPaymentDetailResponseDto>(cacheKey);
        if (cached) return cached;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                application: {
                    select: { participantId: true },
                },
                pricingTier: {
                    select: { name: true, feeType: true },
                },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.application.participantId !== participant.id) {
            throw new ForbiddenException('Access denied');
        }

        const history: PaymentHistoryEntryDto[] = [];

        if (invoice.status === 'paid' && invoice.paidAt) {
            history.push({
                id: invoice.externalTransactionId ?? invoice.id,
                method: invoice.paymentMethod ?? 'payment',
                amount: Number(invoice.amount),
                date: invoice.paidAt.toISOString().split('T')[0],
                time: invoice.paidAt.toISOString().split('T')[1].substring(0, 5),
                status: 'paid',
                note: 'Payment confirmed',
                code: invoice.externalTransactionId ?? undefined,
                paymentMethod: invoice.paymentMethod ?? undefined,
                dateTime: invoice.paidAt.toISOString(),
                amountLabel: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
            });
        } else if (invoice.status === 'processing') {
            history.push({
                id: invoice.externalTransactionId ?? invoice.id,
                method: invoice.paymentMethod ?? 'manual',
                amount: Number(invoice.amount),
                date: invoice.updatedAt.toISOString().split('T')[0],
                time: invoice.updatedAt.toISOString().split('T')[1].substring(0, 5),
                status: 'processing',
                note: 'Payment submitted, awaiting verification',
                code: invoice.externalTransactionId ?? undefined,
                paymentMethod: invoice.paymentMethod ?? undefined,
                dateTime: invoice.updatedAt.toISOString(),
                amountLabel: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
            });
        } else if (invoice.status === 'failed') {
            history.push({
                id: invoice.externalTransactionId ?? invoice.id,
                method: invoice.paymentMethod ?? 'unknown',
                amount: Number(invoice.amount),
                date: invoice.updatedAt.toISOString().split('T')[0],
                time: invoice.updatedAt.toISOString().split('T')[1].substring(0, 5),
                status: 'failed',
                note: 'Payment failed',
                code: invoice.externalTransactionId ?? undefined,
                paymentMethod: invoice.paymentMethod ?? undefined,
                dateTime: invoice.updatedAt.toISOString(),
                amountLabel: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
            });
        }

        const invoiceStatus =
            invoice.status === 'paid' ? 'paid' :
            invoice.status === 'processing' ? 'processing' :
            invoice.status === 'failed' ? 'failed' : 'unpaid';

        const result: PortalPaymentDetailResponseDto = {
            invoice: {
                id: invoice.id,
                label: invoice.pricingTier.name,
                category: invoice.pricingTier.feeType,
                amount: Number(invoice.amount),
                dueDate: undefined,
                status: invoiceStatus,
                currency: invoice.currency,
            },
            history,
        };

        await this.cacheService.set(cacheKey, result, CACHE_TTL.SHORT);
        return result;
    }
}
