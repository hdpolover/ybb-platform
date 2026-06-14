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
                        brandId: true,
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
                usdPrice: true,
                idrPrice: true,
                feeType: true,
                allowedCategories: true,
            },
        });

        if (!tier) {
            throw new NotFoundException('Payment option not found');
        }

        const currentCategory = application.applicationCategory as ApplicationCategory | null;
        // registration_fee is payable by all participant categories — the submit gate
        // requires it from everyone regardless of allowedCategories, so we must not
        // block any category here. For other fee types (full_fee, etc.) the
        // allowedCategories restriction still applies.
        const isRegistrationFee = tier.feeType === 'registration_fee';
        if (
            !isRegistrationFee &&
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

        // Dual-pricing snapshots: prefer the explicit usdPrice/idrPrice fields
        // on the tier when present (admin-curated, locked at invoice creation
        // so later tier edits or FX drift can't retroactively change what the
        // participant owed). Fall back to the legacy `tier.price`/`tier.currency`
        // for tiers not yet migrated to dual-pricing.
        const usdSnapshot = tier.usdPrice !== null && tier.usdPrice !== undefined ? Number(tier.usdPrice) : null;
        const idrSnapshot = tier.idrPrice !== null && tier.idrPrice !== undefined ? Number(tier.idrPrice) : null;

        // Canonical amount/currency for an unpaid invoice: USD if a usdPrice
        // snapshot exists (the new dual-price model treats USD as canonical),
        // otherwise the legacy tier price + currency. On manual confirm the
        // ConfirmPortalPayment handler swaps these to the IDR snapshot.
        const useDualPricing = usdSnapshot !== null;
        const canonicalAmount = useDualPricing ? usdSnapshot : Number(tier.price);
        const canonicalCurrency = useDualPricing ? 'USD' : tier.currency;

        if (Number.isNaN(canonicalAmount) || canonicalAmount < 0) {
            throw new NotFoundException('Payment option amount is invalid');
        }

        let exchangeRateSnapshot = resolveUsdInIdrRate({
            programRate: application.program?.usdInIdr,
        });

        if (exchangeRateSnapshot === undefined && canonicalCurrency.toUpperCase() === 'USD') {
            const brandSettings = await this.prisma.brandSetting.findFirst({
                where: { brandId: application.program?.brandId },
                select: { usdInIdr: true },
            });
            exchangeRateSnapshot = resolveUsdInIdrRate({ programRate: brandSettings?.usdInIdr });
        }

        const invoice = await this.prisma.applicationInvoice.create({
            data: {
                applicationId: application.id,
                pricingTierId: tier.id,
                amount: canonicalAmount,
                currency: canonicalCurrency,
                amountUsd: usdSnapshot,
                amountIdr: idrSnapshot,
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
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId)),
        ]);
    }
}
