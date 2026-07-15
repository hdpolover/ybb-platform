import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { LandingService } from '../landing/landing.service';
import { CapiEventDto } from './dto/capi-event.dto';

// Meta Graph API version. A code constant (not an env var) so a deploy can't
// silently point at an unexpected version — bump it deliberately in a PR.
const GRAPH_VERSION = 'v25.0';

// Only these standard events are accepted. Anything else is rejected upstream
// in the controller so spoofers can't invent arbitrary event names.
export const ALLOWED_EVENT_NAMES: ReadonlySet<string> = new Set([
    'PageView',
    'ViewContent',
    'InitiateCheckout',
    'Lead',
    'CompleteRegistration',
    'Purchase',
]);

// Best-effort in-memory rate limit. Durable/multi-instance limiting should move
// to the platform Redis (see RedisThrottlerStorage) — this only protects a
// single process and resets on restart, which is acceptable for an
// abuse-dampener on a fire-and-forget analytics relay.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 60;

export type CapiForwardResult = { forwarded: boolean };

interface CapiRequestContext {
    host: string | undefined;
    ip: string | undefined;
    userAgent: string | undefined;
}

@Injectable()
export class MetaCapiService {
    private readonly logger = new Logger(MetaCapiService.name);
    private readonly rateBuckets = new Map<string, { count: number; windowStart: number }>();

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
        private readonly landingService: LandingService,
    ) {}

    /**
     * Forwards a browser-originated event to Meta's Conversions API using the
     * brand's server-side pixel + access token. Never throws to the caller —
     * every failure path resolves to a no-op so the public endpoint can always
     * answer 200/204. The access token is used only to authenticate the
     * outbound Graph call; it never appears in the response.
     */
    async forwardEvent(dto: CapiEventDto, ctx: CapiRequestContext): Promise<CapiForwardResult> {
        const host = ctx.host;
        if (!host) {
            return { forwarded: false };
        }

        const brand = await this.resolveBrandSafely(host);
        if (!brand) {
            // Unknown origin — no-op rather than leak which hosts are configured.
            return { forwarded: false };
        }

        if (this.isRateLimited(host, ctx.ip)) {
            return { forwarded: false };
        }

        const settings = await this.prisma.brandSetting.findUnique({
            where: { brandId: brand.id },
            select: { pixelId: true, capiAccessToken: true, capiTestEventCode: true },
        });

        const pixelId = settings?.pixelId ?? null;
        const accessToken = settings?.capiAccessToken ?? null;
        if (!pixelId || !accessToken) {
            // Brand has no CAPI configured — nothing to forward.
            return { forwarded: false };
        }

        const event = this.buildEvent(dto, ctx);
        const payload: Record<string, unknown> = { data: [event] };
        if (settings?.capiTestEventCode) {
            payload.test_event_code = settings.capiTestEventCode;
        }
        // access_token is passed in the JSON body (not the URL) so it never
        // lands in access logs / proxy logs the way a query param would.
        payload.access_token = accessToken;

        try {
            await firstValueFrom(
                this.httpService.post(
                    `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`,
                    payload,
                    { headers: { 'Content-Type': 'application/json' } },
                ),
            );
            return { forwarded: true };
        } catch (error: unknown) {
            // Log server-side for observability, scrubbed of the token and any
            // hashed PII (we only surface Meta's own error envelope + status).
            this.logGraphError(pixelId, error);
            return { forwarded: false };
        }
    }

    private buildEvent(dto: CapiEventDto, ctx: CapiRequestContext): Record<string, unknown> {
        const userData: Record<string, unknown> = {};

        const hashedEmail = this.normalizeAndHash(dto.userData?.email);
        if (hashedEmail) userData.em = hashedEmail;

        const hashedPhone = this.normalizeAndHash(dto.userData?.phone);
        if (hashedPhone) userData.ph = hashedPhone;

        const hashedExternalId = this.normalizeAndHash(dto.userData?.externalId);
        if (hashedExternalId) userData.external_id = hashedExternalId;

        if (ctx.ip) userData.client_ip_address = ctx.ip;
        if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;
        if (dto.fbp) userData.fbp = dto.fbp;
        if (dto.fbc) userData.fbc = dto.fbc;

        const event: Record<string, unknown> = {
            event_name: dto.eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: dto.eventId,
            action_source: 'website',
            user_data: userData,
        };
        if (dto.eventSourceUrl) event.event_source_url = dto.eventSourceUrl;
        if (dto.customData) event.custom_data = dto.customData;

        return event;
    }

    // Meta requires SHA-256 of the lowercased, trimmed value. Absent values are
    // omitted entirely (never hashed-empty), per the CAPI spec.
    private normalizeAndHash(value: string | undefined): string | null {
        if (!value) return null;
        const normalized = value.trim().toLowerCase();
        if (!normalized) return null;
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    private async resolveBrandSafely(host: string) {
        try {
            return await this.landingService.resolveBrand(host);
        } catch {
            // resolveBrand throws NotFoundException for unknown hosts — treat as
            // "no brand" so the endpoint stays a clean no-op.
            return null;
        }
    }

    private isRateLimited(host: string, ip: string | undefined): boolean {
        const key = `${host}|${ip ?? 'unknown'}`;
        const now = Date.now();
        const bucket = this.rateBuckets.get(key);

        if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
            this.rateBuckets.set(key, { count: 1, windowStart: now });
            return false;
        }

        bucket.count += 1;
        return bucket.count > RATE_LIMIT_MAX_PER_WINDOW;
    }

    private logGraphError(pixelId: string, error: unknown): void {
        const axiosLike = error as {
            response?: { status?: number; data?: unknown };
            message?: string;
        };
        const status = axiosLike.response?.status;
        // Meta's error body carries no token/PII — safe to log for debugging.
        const body = axiosLike.response?.data ?? axiosLike.message ?? 'unknown error';
        this.logger.warn(
            `Meta CAPI forward failed for pixel ${pixelId} (status ${status ?? 'n/a'}): ${JSON.stringify(body)}`,
        );
    }
}
