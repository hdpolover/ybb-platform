import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentGatewayClient } from '@modules/payments/infrastructure/services/payment-gateway.client';
import { CancelPortalPaymentCommand } from '../../queries/portal-queries';
import { CancelPortalPaymentResponseDto } from '../../../presentation/dto/portal-payment.dto';

@Injectable()
export class CancelPortalPaymentHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly paymentGatewayClient: PaymentGatewayClient,
    ) {}

    async execute(command: CancelPortalPaymentCommand): Promise<CancelPortalPaymentResponseDto> {
        const participant = await this.portalCacheService.getParticipantProfile(command.userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id: command.invoiceId },
            include: {
                pricingTier: {
                    select: { feeType: true },
                },
                application: {
                    select: { id: true, participantId: true, programId: true },
                },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.application.participantId !== participant.id) {
            throw new ForbiddenException('Access denied');
        }
        if (invoice.status === 'paid') {
            throw new BadRequestException('Paid invoice cannot be cancelled');
        }
        if (invoice.status !== 'processing') {
            throw new BadRequestException('Only pending payments can be cancelled');
        }
        if (!invoice.externalTransactionId) {
            throw new BadRequestException('No pending transaction found for this invoice');
        }

        const cancellationReason = command.reason?.trim() || 'Cancelled by participant';

        const voidResult = await this.paymentGatewayClient.voidTransaction(
            invoice.externalTransactionId,
            invoice.id,
            cancellationReason,
        );
        if (voidResult.outcome === 'danger_settled') {
            throw new BadRequestException(
                'This payment has already succeeded at the gateway and cannot be cancelled. Contact support.',
            );
        }
        if (voidResult.outcome === 'needs_review') {
            throw new BadRequestException(
                'Your payment is under review and cannot be cancelled right now. Please contact support.',
            );
        }
        // Fail closed: this is a synchronous, user-facing cancel action. If we can't verify
        // the gateway's status, proceeding could cancel an invoice whose transaction just
        // settled to SUCCESS at the gateway (cancelled-invoice-but-paid). Failing closed lets
        // the user simply retry instead of risking that danger case.
        if (voidResult.outcome === 'error') {
            throw new BadRequestException(
                'Could not verify the payment status right now. Please try again in a moment.',
            );
        }

        const paymentStatusPatch =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: 'cancelled' as const }
                : { programPaymentStatus: 'cancelled' as const };

        await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id: command.invoiceId },
                data: {
                    status: 'cancelled',
                    rejectionReason: cancellationReason,
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.application.id },
                data: paymentStatusPatch,
            }),
        ]);

        await Promise.all([
            // Covers portal:dashboard:${userId}:* by pattern (Redis-dependent) - the
            // explicit keys below are the precise, store-agnostic fallback since the
            // program is already known here.
            this.cacheService.invalidateInvoiceCache(command.invoiceId, command.userId),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(command.userId)),
            this.cacheService.invalidateKey(
                CACHE_KEYS.PORTAL_PAYMENTS(command.userId, invoice.application.programId),
            ),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(command.userId)),
            this.cacheService.invalidateKey(
                CACHE_KEYS.PORTAL_DASHBOARD(command.userId, invoice.application.programId),
            ),
        ]);

        return {
            invoice_id: command.invoiceId,
            status: 'CANCELLED',
            message: 'Pending payment cancelled successfully.',
        };
    }
}
