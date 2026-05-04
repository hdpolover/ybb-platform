import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalPaymentDetailQuery } from '../portal-queries';
import { PaymentServiceHttpClient } from '@modules/payments/infrastructure/services/payment-service-http.client';
import {
    PortalPaymentDetailResponseDto,
    PaymentHistoryEntryDto,
} from '../../../presentation/dto/portal-payment.dto';

@Injectable()
@QueryHandler(GetPortalPaymentDetailQuery)
export class GetPortalPaymentDetailHandler implements IQueryHandler<GetPortalPaymentDetailQuery> {
    private readonly logger = new Logger(GetPortalPaymentDetailHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
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
                    select: {
                        name: true,
                        feeType: true,
                        validityPeriods: {
                            select: {
                                startDate: true,
                                endDate: true,
                            },
                            orderBy: { startDate: 'asc' },
                        },
                    },
                },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.application.participantId !== participant.id) {
            throw new ForbiddenException('Access denied');
        }

        const actionUrl = await this.resolvePendingActionUrl(invoice.externalTransactionId);
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
                actionUrl,
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

        const now = new Date();
        const periodByInvoiceDate = invoice.pricingTier.validityPeriods.find((period) => (
            period.startDate <= invoice.createdAt && period.endDate >= invoice.createdAt
        ));
        const nearestActiveOrUpcomingPeriod = invoice.pricingTier.validityPeriods.find((period) => period.endDate >= now);
        const periods = invoice.pricingTier.validityPeriods;
        const fallbackLatestPeriod = periods.length > 0 ? periods[periods.length - 1] : undefined;
        const dueDate = periodByInvoiceDate?.endDate ?? nearestActiveOrUpcomingPeriod?.endDate ?? fallbackLatestPeriod?.endDate;

        const result: PortalPaymentDetailResponseDto = {
            invoice: {
                id: invoice.id,
                label: invoice.pricingTier.name,
                category: invoice.pricingTier.feeType,
                amount: Number(invoice.amount),
                dueDate: dueDate?.toISOString(),
                status: invoiceStatus,
                currency: invoice.currency,
            },
            history,
        };

        await this.cacheService.set(cacheKey, result, CACHE_TTL.SHORT);
        return result;
    }

    private buildInternalHeaders(): Record<string, string> {
        const internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '').trim();
        return internalKey ? { 'X-Internal-Service-Key': internalKey } : {};
    }

    private async resolvePendingActionUrl(transactionId?: string | null): Promise<string | undefined> {
        if (!transactionId) {
            return undefined;
        }

        try {
            const { data } = await this.paymentServiceClient.get<unknown>(
                `/api/v1/payments/${transactionId}`,
                { headers: this.buildInternalHeaders() },
            );
            return this.extractActionUrl(data);
        } catch (error) {
            this.logger.debug(`Failed to resolve action URL for ${transactionId}: ${(error as Error).message}`);
            return undefined;
        }
    }

    private extractActionUrl(payload: unknown): string | undefined {
        const data = this.unwrapPayloadObject(payload);
        const direct = this.pickString(
            data.action_url,
            data.redirect_url,
            data.checkout_url,
            data.invoice_url,
            data.payment_url,
            data.url,
        );
        if (direct) return direct;

        const gatewayResponse = this.toRecord(data.gateway_response);
        if (gatewayResponse) {
            const fromGateway = this.pickString(
                gatewayResponse.action_url,
                gatewayResponse.redirect_url,
                gatewayResponse.checkout_url,
                gatewayResponse.invoice_url,
                gatewayResponse.payment_url,
                gatewayResponse.url,
            );
            if (fromGateway) return fromGateway;
        }

        return undefined;
    }

    private unwrapPayloadObject(payload: unknown): Record<string, unknown> {
        const direct = this.toRecord(payload);
        if (!direct) {
            return {};
        }

        const nested = this.toRecord(direct.data);
        return nested ?? direct;
    }

    private toRecord(value: unknown): Record<string, unknown> | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        return value as Record<string, unknown>;
    }

    private pickString(...values: unknown[]): string | undefined {
        for (const value of values) {
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
        return undefined;
    }
}
