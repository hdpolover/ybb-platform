import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ApplicationCategory } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { EnsurePortalPaymentInvoiceCommand } from '../../queries/portal-queries';
import { EnsurePortalPaymentInvoiceResponseDto } from '../../../presentation/dto/portal-payment.dto';
import { resolveUsdInIdrRate } from '../../utils/resolve-usd-in-idr-rate';

@Injectable()
export class EnsurePortalPaymentInvoiceHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(
        command: EnsurePortalPaymentInvoiceCommand,
    ): Promise<EnsurePortalPaymentInvoiceResponseDto> {
        const { userId, pricingTierId, programId } = command;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) {
            throw new NotFoundException('Participant not found');
        }

        const application = await this.prisma.participantApplication.findFirst({
            where: {
                participantId: participant.id,
                ...(programId ? { programId } : {}),
            },
            select: {
                id: true,
                programId: true,
                applicationCategory: true,
                program: {
                    select: {
                        usdInIdr: true,
                        brand: {
                            select: {
                                settings: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        const tier = await this.prisma.programPricingTier.findFirst({
            where: {
                id: pricingTierId,
                programId: application.programId,
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                price: true,
                currency: true,
                allowedCategories: true,
            },
        });

        if (!tier) {
            throw new NotFoundException('Payment option not found');
        }

        const currentCategory = application.applicationCategory as ApplicationCategory | null;
        if (
            currentCategory &&
            tier.allowedCategories.length > 0 &&
            !tier.allowedCategories.includes(currentCategory)
        ) {
            throw new ForbiddenException('This payment option is not available for your current category');
        }

        const existingInvoice = await this.prisma.applicationInvoice.findFirst({
            where: {
                applicationId: application.id,
                pricingTierId: tier.id,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        if (existingInvoice) {
            await this.invalidatePortalPaymentCaches(userId, application.programId, existingInvoice.id);
            return {
                invoice_id: existingInvoice.id,
                source: 'existing',
                message: 'Invoice is ready',
            };
        }

        const amount = Number(tier.price);
        if (Number.isNaN(amount) || amount < 0) {
            throw new NotFoundException('Payment option amount is invalid');
        }

        const exchangeRateSnapshot = resolveUsdInIdrRate({
            programRate: application.program?.usdInIdr,
            brandSettings: application.program?.brand?.settings,
        });

        const invoice = await this.prisma.applicationInvoice.create({
            data: {
                applicationId: application.id,
                pricingTierId: tier.id,
                amount,
                currency: tier.currency,
                status: 'unpaid',
                exchangeRateSnapshot,
            },
            select: { id: true },
        });

        await this.invalidatePortalPaymentCaches(userId, application.programId, invoice.id);

        return {
            invoice_id: invoice.id,
            source: 'created',
            message: `Invoice created for ${tier.name}`,
        };
    }

    private async invalidatePortalPaymentCaches(
        userId: string,
        programId: string,
        invoiceId: string,
    ): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(userId, programId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(invoiceId)),
        ]);
    }
}
