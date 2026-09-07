import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { LandingService } from '../landing/landing.service';
import { CapiEventDto } from './dto/capi-event.dto';
import { normalizeAndHash } from './hash.util';
import { TikTokEventsService } from './tiktok-events.service';

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
    'ApplicationCreated',
    'ProgramFeePaid',
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

// Params for a trusted, internally-triggered conversion event (no HTTP
// request/Origin involved) — e.g. a manual-transfer payment settling, or an
// application being created during login/register. `eventId` MUST be the
// exact same string the frontend generates for its own client-side fire of
// the same business event (see each call site's comment) — Meta/TikTok
// dedupe browser + server events on an identical event_id, so any drift here
// silently breaks dedup and double-counts the conversion.
export interface ServerCapiEventParams {
    brandId: string;
    eventName: string;
    eventId: string;
    customData?: Record<string, unknown>;
    userData?: { email?: string; phone?: string; externalId?: string };
    eventSourceUrl?: string;
    // Ad click identifiers captured from the browser at signup and replayed
    // here (see participants.ad_attribution) — reuses the exact same
    // CapiEventDto fields the browser relay (forwardEvent) already sends, so
    // buildEvent/TikTokEventsService.buildPayload need no server-event-specific
    // branch to pick them up. Without these a server-emitted conversion can be
    // COUNTED but not ATTRIBUTED to the ad that drove it.
    fbp?: string;
    fbc?: string;
    ttp?: string;
    ttclid?: string;
}

@Injectable()
export class MetaCapiService {
    private readonly logger = new Logger(MetaCapiService.name);
    private readonly rateBuckets = new Map<string, { count: number; windowStart: number }>();

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
        private readonly landingService: LandingService,
        private readonly tiktokEventsService: TikTokEventsService,
    ) {}

    /**
     * Forwards a browser-originated event to Meta's Conversions API using the
     * brand's server-side pixel + access token, AND fans the same event out to
     * TikTok's Events API (same eventId, so TikTok dedupes it like Meta does).
     * Never throws to the caller — every failure path resolves to a no-op so
     * the public endpoint can always answer 200/204. The two sends run in
     * parallel and are fully independent: a TikTok failure never affects the
     * Meta send, the returned result, or the HTTP response, and vice versa.
     * Access tokens are used only to authenticate the outbound calls; they
     * never appear in the response.
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

        // Fire both platforms in parallel. TikTok's outcome never affects the
        // Meta result returned below — see the doc comment above.
        const [metaResult] = await Promise.all([
            this.sendToMeta(brand.id, dto, ctx),
            this.tiktokEventsService.forwardEvent(brand.id, dto, ctx),
        ]);
        return metaResult;
    }

    /**
     * Server-to-server twin of forwardEvent() for callers with no HTTP request
     * context (payment settlement, application creation). Deliberately:
     *   - takes brandId directly instead of resolving one from an Origin host,
     *     which also means it BYPASSES isRateLimited() — that limiter exists to
     *     stop a spoofed browser from hammering the public /meta/capi endpoint,
     *     and must never throttle our own trusted server-side business events.
     *   - never throws or rejects, under any circumstance: this is fire-and-
     *     forget analytics, and a conversion-tracking failure must never fail
     *     the payment/registration flow that triggered it. Callers should not
     *     await the returned promise for that reason; it's provided only for
     *     tests.
     */
    async emitServerEvent(params: ServerCapiEventParams): Promise<void> {
        try {
            // Meta treats fbc/fbp as website-origin signals. A server event that
            // carries a real browser-derived click id is no longer the
            // page-less "system_generated" case buildEvent's default was
            // written for — it needs action_source 'website' plus a real
            // event_source_url, which we don't have (no HTTP request here) but
            // can synthesize from the owning brand's public domain. Only do
            // this when the caller didn't already supply one and there's
            // actually a click id to justify it — an event with no ad
            // attribution at all has no website signal to report and stays
            // 'system_generated' (see buildEvent below).
            const hasClickId = Boolean(params.fbp || params.fbc || params.ttp || params.ttclid);
            const eventSourceUrl =
                params.eventSourceUrl ?? (hasClickId ? await this.resolveBrandDomainSafely(params.brandId) : undefined);

            const dto: CapiEventDto = {
                eventName: params.eventName,
                eventId: params.eventId,
                eventSourceUrl,
                customData: params.customData,
                userData: params.userData,
                fbp: params.fbp,
                fbc: params.fbc,
                ttp: params.ttp,
                ttclid: params.ttclid,
            };
            const ctx: CapiRequestContext = { host: undefined, ip: undefined, userAgent: undefined };

            await Promise.all([
                this.sendToMeta(params.brandId, dto, ctx, true),
                this.tiktokEventsService.forwardEvent(params.brandId, dto, ctx),
            ]);
        } catch (error: unknown) {
            // Both sendToMeta and TikTokEventsService.forwardEvent already
            // swallow their own errors and resolve to { forwarded: false } — this
            // catch only guards against something unexpected (e.g. a Prisma
            // connection error thrown before either call's own try/catch), so
            // this method truly never throws to its caller.
            this.logger.error(
                `emitServerEvent failed unexpectedly for brand ${params.brandId} event ${params.eventName}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    private async sendToMeta(
        brandId: string,
        dto: CapiEventDto,
        ctx: CapiRequestContext,
        isServerEvent = false,
    ): Promise<CapiForwardResult> {
        const settings = await this.prisma.brandSetting.findUnique({
            where: { brandId },
            select: { pixelId: true, capiAccessToken: true, capiTestEventCode: true },
        });

        const pixelId = settings?.pixelId ?? null;
        const accessToken = settings?.capiAccessToken ?? null;
        if (!pixelId || !accessToken) {
            // Brand has no CAPI configured — nothing to forward.
            return { forwarded: false };
        }

        const event = this.buildEvent(dto, ctx, isServerEvent);
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

    private buildEvent(dto: CapiEventDto, ctx: CapiRequestContext, isServerEvent = false): Record<string, unknown> {
        const userData: Record<string, unknown> = {};

        const hashedEmail = normalizeAndHash(dto.userData?.email);
        if (hashedEmail) userData.em = hashedEmail;

        const hashedPhone = normalizeAndHash(dto.userData?.phone);
        if (hashedPhone) userData.ph = hashedPhone;

        const hashedExternalId = normalizeAndHash(dto.userData?.externalId);
        if (hashedExternalId) userData.external_id = hashedExternalId;

        if (ctx.ip) userData.client_ip_address = ctx.ip;
        if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;
        if (dto.fbp) userData.fbp = dto.fbp;
        if (dto.fbc) userData.fbc = dto.fbc;

        // Meta requires event_source_url whenever action_source is 'website'. The
        // browser path always has one (or is willing to be rejected as if it
        // did — unchanged from before this method took an isServerEvent flag).
        // A server-originated event, though, often has no page URL to report
        // (e.g. a bank-transfer settling asynchronously) — 'system_generated' is
        // Meta's action_source for exactly that case, and does not require one.
        const actionSource = isServerEvent && !dto.eventSourceUrl ? 'system_generated' : 'website';

        const event: Record<string, unknown> = {
            event_name: dto.eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: dto.eventId,
            action_source: actionSource,
            user_data: userData,
        };
        if (dto.eventSourceUrl) event.event_source_url = dto.eventSourceUrl;
        if (dto.customData) event.custom_data = dto.customData;

        return event;
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

    /**
     * Best-effort lookup of a brand's public domain, used ONLY to synthesize
     * event_source_url for a server event that carries a real ad click id
     * (see emitServerEvent). Never from a request header — there is no
     * request on this path. Swallows its own errors: a failed lookup here
     * must not cancel the actual conversion send, it just goes out without
     * event_source_url (buildEvent falls back to 'system_generated').
     */
    private async resolveBrandDomainSafely(brandId: string): Promise<string | undefined> {
        try {
            const brand = await this.prisma.brand.findUnique({
                where: { id: brandId },
                select: { landingUrl: true, websiteUrl: true },
            });
            const domain = (brand?.landingUrl ?? brand?.websiteUrl ?? '').trim().replace(/\/$/, '');
            return domain || undefined;
        } catch {
            return undefined;
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
