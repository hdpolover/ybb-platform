// services/api/src/modules/checkout/checkout.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@shared/decorators/public.decorator';
import { BrandDomain } from '@shared/decorators/brand-domain.decorator';
import { clientIpTracker } from '@shared/infrastructure/throttler/user-aware-throttler.guard';
import { CheckoutPolicyService } from './checkout-policy.service';
import { CheckoutConfigQueryDto, CheckoutConfigResponseDto } from './dto/checkout-config.dto';

const FIFTEEN_MINUTES = 900000;

// Per client IP, sized for a building (a school lab opening the same cart link).
// `long` duplicates `default` on purpose: a route-level @Throttle only displaces
// the global tier of the same name, so omitting it leaves the global 300/60s tier
// in force (see MAILBOX_THROTTLE in auth.controller.ts).
const CONFIG_IP_TIER = { limit: 120, ttl: FIFTEEN_MINUTES, getTracker: clientIpTracker };
const CONFIG_THROTTLE = { default: CONFIG_IP_TIER, long: CONFIG_IP_TIER };

@ApiTags('Checkout')
@Controller('checkout')
@Public()
@ApiHeader({ name: 'x-brand-domain', required: false })
export class CheckoutController {
    constructor(
        private readonly policy: CheckoutPolicyService,
        private readonly config: ConfigService,
    ) {}

    @Get('config')
    @Throttle(CONFIG_THROTTLE)
    @ApiOperation({ summary: 'Checkout feature flag, Turnstile site key and the authoritative registration-fee quote' })
    async getConfig(
        @Query() query: CheckoutConfigQueryDto,
        @BrandDomain() brandDomain?: string,
    ): Promise<CheckoutConfigResponseDto> {
        const enabled = this.config.get<string>('CHECKOUT_ENABLED') === 'true';
        const turnstileSiteKey = this.config.get<string>('TURNSTILE_SITE_KEY') || null;

        // Flag off: answer without touching the DB or revealing any offer.
        if (!enabled) {
            return { enabled, quote: null, turnstileSiteKey };
        }

        const brandId = await this.policy.resolveBrandId(brandDomain);
        const offer = await this.policy.resolveOffer({
            brandId,
            programSlug: query.programSlug,
            tierId: query.tierId,
            category: query.category,
        });

        return {
            enabled,
            quote: {
                programName: offer.programName,
                programSlug: offer.programSlug,
                tierId: offer.tierId,
                tierName: offer.tierName,
                category: offer.category,
                amount: offer.amount,
                currency: offer.currency,
                ...(offer.amountIdr !== null ? { amountIdr: offer.amountIdr } : {}),
            },
            turnstileSiteKey,
        };
    }
}
