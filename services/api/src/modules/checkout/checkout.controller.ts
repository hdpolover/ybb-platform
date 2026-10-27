// services/api/src/modules/checkout/checkout.controller.ts
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@shared/decorators/public.decorator';
import { BrandDomain } from '@shared/decorators/brand-domain.decorator';
import { ClientIp } from '@shared/decorators/client-ip.decorator';
import { MAILBOX_THROTTLE } from '@modules/auth/presentation/auth.controller';
import { clientIpTracker } from '@shared/infrastructure/throttler/user-aware-throttler.guard';
import { CheckoutPolicyService } from './checkout-policy.service';
import { CheckoutHandler, CheckoutResponse } from './checkout.handler';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
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
        private readonly checkout: CheckoutHandler,
    ) {}

    @Get('config')
    @Throttle(CONFIG_THROTTLE)
    @ApiOperation({ summary: 'Checkout feature flag, Turnstile site key and the open editions with their registration-fee options' })
    async getConfig(
        @Query() query: CheckoutConfigQueryDto,
        @BrandDomain() brandDomain?: string,
    ): Promise<CheckoutConfigResponseDto> {
        const enabled = this.config.get<string>('CHECKOUT_ENABLED') === 'true';
        const turnstileSiteKey = this.config.get<string>('TURNSTILE_SITE_KEY') || null;

        // Flag off: answer without touching the DB or revealing any offer.
        if (!enabled) {
            return { enabled, turnstileSiteKey, editions: [], selected: null };
        }

        const brandId = await this.policy.resolveBrandId(brandDomain);
        const editions = await this.policy.listOffers(brandId);

        // Preselect only when the query names an option that is actually on offer.
        const matches = editions
            .filter((e) => e.programSlug === query.programSlug)
            .flatMap((e) => e.options.filter((o) => o.tierId === query.tierId && (!query.category || o.category === query.category)));
        // A tier that allows several categories is ambiguous without ?category.
        const selected =
            matches.length === 1
                ? { programSlug: query.programSlug as string, category: matches[0].category, tierId: matches[0].tierId }
                : null;

        return { enabled, turnstileSiteKey, editions, selected };
    }

    @Post()
    // Same tiers as POST /auth/register (10/hour per mailbox, 600/15min per IP, both
    // tier names overridden); see MAILBOX_THROTTLE for why.
    @Throttle(MAILBOX_THROTTLE)
    @ApiOperation({ summary: 'Create an account, mint the registration-fee invoice and start the gateway payment in one step' })
    async create(
        @Body() dto: CreateCheckoutDto,
        @BrandDomain() brandDomain?: string,
        @ClientIp() ip?: string,
        @Req() req?: Request,
    ): Promise<CheckoutResponse> {
        return this.checkout.execute(dto, {
            brandDomain,
            ip: ip || '0.0.0.0',
            userAgent: req?.headers['user-agent'] || 'unknown',
        });
    }
}
