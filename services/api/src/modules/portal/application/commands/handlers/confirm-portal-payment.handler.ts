import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { ConfirmPortalPaymentCommand } from '../../queries/portal-queries';
import { ConfirmPortalPaymentResponseDto } from '../../../presentation/dto/portal-payment.dto';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { resolveUsdInIdrRate } from '../../utils/resolve-usd-in-idr-rate';

@Injectable()
export class ConfirmPortalPaymentHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly paymentClient: PaymentGrpcClient,
    ) {}

    async execute(command: ConfirmPortalPaymentCommand): Promise<ConfirmPortalPaymentResponseDto> {
        const { userId, invoiceId, paymentType, paymentMethodId, details } = command;
        if (paymentType === 'manual') {
            if (!details?.accountName?.trim()) {
                throw new BadRequestException('Account name is required for manual payment');
            }
            if (!details?.sourceName?.trim()) {
                throw new BadRequestException('Source name is required for manual payment');
            }
            if (!details?.paymentDate?.trim()) {
                throw new BadRequestException('Payment date is required for manual payment');
            }
            if (!details?.proofFileUrl?.trim()) {
                throw new BadRequestException('Payment proof is required for manual payment');
            }
        }

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                application: {
                    select: {
                        participantId: true,
                        programId: true,
                        program: {
                            select: {
                                name: true,
                                currency: true,
                                usdInIdr: true,
                            },
                        },
                        participant: {
                            select: {
                                fullName: true,
                                user: {
                                    select: { email: true },
                                },
                            },
                        },
                    },
                },
                pricingTier: {
                    select: {
                        name: true,
                        isActive: true,
                        deletedAt: true,
                    },
                },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.application.participantId !== participant.id) {
            throw new ForbiddenException('Access denied');
        }
        if (invoice.status === 'paid') {
            throw new BadRequestException('Invoice is already paid');
        }
        if (invoice.status === 'processing') {
            throw new BadRequestException('This invoice already has a pending payment. Please continue the existing payment from Payment Details.');
        }
        if (!invoice.pricingTier.isActive || invoice.pricingTier.deletedAt) {
            throw new BadRequestException('This payment option is no longer available for new payments.');
        }

        // Build customer identity for downstream events (notification service uses
        // these to address receipts and status emails). Without `email` in metadata,
        // payment.succeeded / payment.failed events get dropped silently by the
        // notification consumer because it short-circuits when `data.email` is empty.
        const customerEmail = invoice.application.participant?.user?.email ?? '';
        const customerName = invoice.application.participant?.fullName ?? customerEmail;
        const exchangeRate = resolveUsdInIdrRate({
            snapshot: invoice.exchangeRateSnapshot,
            programRate: invoice.application.program.usdInIdr,
        });

        // Create a payment intent via the Payment Service
        const intentResponse = await this.paymentClient.createIntent({
            user_id: userId,
            participant_id: participant.id,
            amount: Number(invoice.amount),
            currency: invoice.currency,
            reference_type: 'invoice',
            reference_id: invoice.id,
            description: `${invoice.pricingTier.name} - ${invoice.application.program.name}`,
            metadata: {
                invoice_id: invoice.id,
                application_id: invoice.applicationId,
                program_id: invoice.application.programId,
                payment_method: paymentMethodId,
                email: customerEmail,
                customer_email: customerEmail,
                customer_name: customerName,
                payment_category: 'registration',
            },
            exchange_rate: exchangeRate,
        });

        if (paymentType === 'manual') {
            // Submit manual payment details to the Payment Service
            const manualResponse = await this.paymentClient.submitManualPayment({
                intent_id: intentResponse.intent_id,
                proof_file_id: details?.proofFileId,
                proof_file_url: details?.proofFileUrl,
                details: JSON.stringify({
                    account_name: details?.accountName,
                    source_name: details?.sourceName,
                    payment_date: details?.paymentDate,
                    payment_method: paymentMethodId,
                    proof_file_id: details?.proofFileId,
                    proof_file_url: details?.proofFileUrl,
                    notes: details?.notes,
                }),
            });

            // Mark invoice as processing
            await this.prisma.applicationInvoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'processing',
                    paymentMethod: paymentMethodId,
                    externalIntentId: intentResponse.intent_id,
                    externalTransactionId: manualResponse.transaction_id,
                },
            });

            // Invalidate caches
            await Promise.all([
                this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(userId)),
                this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(invoiceId)),
            ]);

            return {
                status: 'PROCESSING',
                invoice_id: invoiceId,
                intent_id: intentResponse.intent_id,
                message: 'Manual payment submitted successfully. Our team will verify your payment shortly.',
            };
        }

        // Gateway payment: process via Payment Service
        const processResponse = await this.paymentClient.processPayment({
            intent_id: intentResponse.intent_id,
            payment_method_id: paymentMethodId,
            gateway_token: details?.gatewayToken,
        });

        // Update invoice with intent reference
        await this.prisma.applicationInvoice.update({
            where: { id: invoiceId },
            data: {
                status: 'processing',
                paymentMethod: paymentMethodId,
                externalIntentId: intentResponse.intent_id,
                externalTransactionId: processResponse.transaction_id,
            },
        });

        // Invalidate caches
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(invoiceId)),
        ]);

        const action = processResponse.action
            ? { type: processResponse.action.type as 'redirect' | 'checkout', url: processResponse.action.url ?? '' }
            : undefined;

        return {
            status: processResponse.status === 'PENDING' ? 'REQUIRES_ACTION' : processResponse.status,
            invoice_id: invoiceId,
            intent_id: intentResponse.intent_id,
            action,
            message: action
                ? 'Redirecting to payment gateway. Please complete your payment there.'
                : 'Payment initiated successfully.',
        };
    }
}
