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
import { resolveUsdInIdrRate } from '../../utils/resolve-usd-in-idr-rate';

interface PendingTransactionContext {
    actionUrl?: string;
    accountName?: string;
    sourceName?: string;
    paymentDate?: string;
    proofUrl?: string;
}

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

        // Cache key includes userId to prevent cross-participant IDOR on a cache hit.
        // Participant B cannot read Participant A's invoice by guessing the invoiceId.
        const cacheKey = CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId);
        const cached = await this.cacheService.get<PortalPaymentDetailResponseDto>(cacheKey);
        if (cached) return cached;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                application: {
                    select: {
                        participantId: true,
                        program: {
                            select: {
                                usdInIdr: true,
                                brandId: true,
                                paymentInfoHtml: true,
                            },
                        },
                    },
                },
                pricingTier: {
                    select: {
                        name: true,
                        feeType: true,
                        price: true,
                        currency: true,
                        usdPrice: true,
                        idrPrice: true,
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

        const pendingContext = await this.resolvePendingTransactionContext(invoice.externalTransactionId);
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
                invoiceId: invoice.id,
                transactionId: invoice.externalTransactionId ?? undefined,
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
                invoiceId: invoice.id,
                transactionId: invoice.externalTransactionId ?? undefined,
                paymentMethod: invoice.paymentMethod ?? undefined,
                dateTime: invoice.updatedAt.toISOString(),
                amountLabel: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
                actionUrl: pendingContext.actionUrl,
                accountName: pendingContext.accountName,
                sourceName: pendingContext.sourceName,
                paymentDate: pendingContext.paymentDate,
                proofUrl: pendingContext.proofUrl,
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
                invoiceId: invoice.id,
                transactionId: invoice.externalTransactionId ?? undefined,
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
        let exchangeRate = resolveUsdInIdrRate({
            snapshot: invoice.exchangeRateSnapshot,
            programRate: invoice.application.program?.usdInIdr,
        });

        if (exchangeRate === undefined && invoice.currency.toUpperCase() === 'USD') {
            const brandSettings = await this.prisma.brandSetting.findFirst({
                where: { brandId: invoice.application.program?.brandId },
                select: { usdInIdr: true },
            });
            exchangeRate = resolveUsdInIdrRate({ programRate: brandSettings?.usdInIdr });
        }

        // Resolve dual prices. The invoice's own amountUsd/amountIdr snapshots
        // are authoritative — they freeze what the participant was quoted at
        // intent creation, so later tier price edits don't retroactively change
        // historic invoices. Fall back to the tier (with legacy currency mapping)
        // only when the snapshot is missing (legacy invoices created before the
        // snapshot columns existed).
        const tier = invoice.pricingTier;
        const legacyTierPrice = Number(tier.price);
        const legacyTierCurrency = (tier.currency || '').toUpperCase();
        const tierUsdPrice = tier.usdPrice !== null && tier.usdPrice !== undefined
            ? Number(tier.usdPrice)
            : (legacyTierCurrency === 'USD' ? legacyTierPrice : 0);
        const tierIdrPrice = tier.idrPrice !== null && tier.idrPrice !== undefined
            ? Number(tier.idrPrice)
            : (legacyTierCurrency === 'IDR' ? legacyTierPrice : 0);
        const usdPrice = invoice.amountUsd !== null && invoice.amountUsd !== undefined
            ? Number(invoice.amountUsd)
            : tierUsdPrice;
        const idrPrice = invoice.amountIdr !== null && invoice.amountIdr !== undefined
            ? Number(invoice.amountIdr)
            : tierIdrPrice;

        // Surface the participant's submission details inline on the invoice when a
        // payment is awaiting verification. This avoids forcing the participant to
        // open the "Payment History" modal to confirm what they submitted.
        const pendingSubmission = invoiceStatus === 'processing'
            ? {
                  accountName: pendingContext.accountName,
                  sourceName: pendingContext.sourceName,
                  paymentDate: pendingContext.paymentDate,
                  proofUrl: pendingContext.proofUrl,
                  paymentMethod: invoice.paymentMethod ?? undefined,
                  actionUrl: pendingContext.actionUrl,
                  submittedAt: invoice.updatedAt.toISOString(),
              }
            : undefined;

        const result: PortalPaymentDetailResponseDto = {
            invoice: {
                id: invoice.id,
                label: invoice.pricingTier.name,
                category: invoice.pricingTier.feeType,
                amount: Number(invoice.amount),
                dueDate: dueDate?.toISOString(),
                status: invoiceStatus,
                currency: invoice.currency,
                transactionId: invoice.externalTransactionId ?? undefined,
                intentId: invoice.externalIntentId ?? undefined,
                exchangeRate,
                usdPrice,
                idrPrice,
                paymentInfoHtml: invoice.application.program?.paymentInfoHtml ?? null,
                pendingSubmission,
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

    private async resolvePendingTransactionContext(transactionId?: string | null): Promise<PendingTransactionContext> {
        if (!transactionId) {
            return {};
        }

        try {
            const { data } = await this.paymentServiceClient.get<unknown>(
                `/api/v1/payments/${transactionId}`,
                { headers: this.buildInternalHeaders() },
            );
            return this.extractPendingTransactionContext(data);
        } catch (error) {
            this.logger.debug(`Failed to resolve action URL for ${transactionId}: ${(error as Error).message}`);
            return {};
        }
    }

    private extractPendingTransactionContext(payload: unknown): PendingTransactionContext {
        const data = this.unwrapPayloadObject(payload);
        const actionUrl = this.pickString(
            data.action_url,
            data.redirect_url,
            data.checkout_url,
            data.invoice_url,
            data.payment_url,
            data.url,
        );

        const gatewayResponse = this.toRecord(data.gateway_response);
        const notesJson = this.pickString(gatewayResponse?.notes);
        const notes = notesJson ? this.tryParseObject(notesJson) : null;

        const accountName = this.pickString(
            data.account_name,
            gatewayResponse?.account_name,
            notes?.account_name,
        );
        const sourceName = this.pickString(
            data.source_name,
            gatewayResponse?.source_name,
            notes?.source_name,
        );
        const paymentDate = this.pickString(
            data.payment_date,
            gatewayResponse?.payment_date,
            notes?.payment_date,
        );
        const proofUrl = this.pickString(
            data.proof_file_url,
            data.proof_url,
            gatewayResponse?.proof_file_url,
            gatewayResponse?.proof_url,
            notes?.proof_file_url,
            notes?.proof_url,
        );

        if (gatewayResponse) {
            return {
                actionUrl: actionUrl ?? this.pickString(
                    gatewayResponse.action_url,
                    gatewayResponse.redirect_url,
                    gatewayResponse.checkout_url,
                    gatewayResponse.invoice_url,
                    gatewayResponse.payment_url,
                    gatewayResponse.url,
                ),
                accountName,
                sourceName,
                paymentDate,
                proofUrl,
            };
        }

        return {
            actionUrl,
            accountName,
            sourceName,
            paymentDate,
            proofUrl,
        };
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

    private tryParseObject(value: string): Record<string, unknown> | null {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
            return null;
        } catch {
            return null;
        }
    }
}
