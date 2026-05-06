import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentServiceHttpClient } from '@modules/payments/infrastructure/services/payment-service-http.client';
import { CancelPortalPaymentCommand } from '../../queries/portal-queries';
import { CancelPortalPaymentResponseDto } from '../../../presentation/dto/portal-payment.dto';

@Injectable()
export class CancelPortalPaymentHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
    ) {}

    async execute(command: CancelPortalPaymentCommand): Promise<CancelPortalPaymentResponseDto> {
        const participant = await this.portalCacheService.getParticipantProfile(command.userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id: command.invoiceId },
            include: {
                application: {
                    select: { participantId: true, programId: true },
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

        const internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '').trim();
        const headers = internalKey ? { 'X-Internal-Service-Key': internalKey } : {};

        await this.paymentServiceClient.post(
            `/api/v1/payments/${invoice.externalTransactionId}/cancel`,
            { reason: command.reason ?? 'Cancelled by participant' },
            { headers },
        );

        await this.prisma.applicationInvoice.update({
            where: { id: command.invoiceId },
            data: {
                status: 'unpaid',
                paymentMethod: null,
                externalIntentId: null,
                externalTransactionId: null,
            },
        });

        await Promise.all([
            this.cacheService.invalidateInvoiceCache(command.invoiceId, command.userId),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(command.userId)),
            this.cacheService.invalidateKey(
                CACHE_KEYS.PORTAL_PAYMENTS(command.userId, invoice.application.programId),
            ),
        ]);

        return {
            invoice_id: command.invoiceId,
            status: 'CANCELLED',
            message: 'Pending payment cancelled successfully.',
        };
    }
}
