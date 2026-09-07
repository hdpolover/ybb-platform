import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CapiEventDto } from './dto/capi-event.dto';
import { normalizeAndHash } from './hash.util';

const TIKTOK_TRACK_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

// Meta standard event name -> TikTok standard event name. Deliberately NOT a
// 1:1 name mapping — the two platforms' vocabularies cross over in a way that
// looks like a bug but isn't:
//   - Meta `Lead` (account signup) -> TikTok `CompleteRegistration`
//   - Meta `CompleteRegistration` (application submitted) -> TikTok `SubmitForm`
// Do NOT "fix" this by aligning the names; it correctly reflects what each
// platform's optimization event actually means for our funnel.
export const META_TO_TIKTOK_EVENT_NAME: Readonly<Record<string, string>> = {
    PageView: 'Pageview',
    ViewContent: 'ViewContent',
    InitiateCheckout: 'InitiateCheckout',
    Lead: 'CompleteRegistration',
    ApplicationCreated: 'ApplicationCreated',
    Purchase: 'CompletePayment',
    ProgramFeePaid: 'ProgramFeePaid',
    CompleteRegistration: 'SubmitForm',
};

export type TikTokForwardResult = { forwarded: boolean };

interface TikTokRequestContext {
    ip: string | undefined;
    userAgent: string | undefined;
}

@Injectable()
export class TikTokEventsService {
    private readonly logger = new Logger(TikTokEventsService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Forwards a browser-originated event to TikTok's Events API 2.0 using the
     * brand's server-side pixel + access token. Never throws to the caller —
     * every failure path resolves to a no-op, same discipline as
     * MetaCapiService. The access token is used only to authenticate the
     * outbound call; it never appears in the response or logs.
     */
    async forwardEvent(
        brandId: string,
        dto: CapiEventDto,
        ctx: TikTokRequestContext,
    ): Promise<TikTokForwardResult> {
        const tiktokEventName = META_TO_TIKTOK_EVENT_NAME[dto.eventName];
        if (!tiktokEventName) {
            // No mapping for this event on TikTok — nothing to forward.
            return { forwarded: false };
        }

        const settings = await this.prisma.brandSetting.findUnique({
            where: { brandId },
            select: { tiktokPixelId: true, tiktokAccessToken: true, tiktokTestEventCode: true },
        });

        const pixelId = settings?.tiktokPixelId ?? null;
        const accessToken = settings?.tiktokAccessToken ?? null;
        if (!pixelId || !accessToken) {
            // Brand has no TikTok Events API configured — nothing to forward.
            return { forwarded: false };
        }

        const payload = this.buildPayload(pixelId, tiktokEventName, dto, ctx, settings?.tiktokTestEventCode);

        try {
            await firstValueFrom(
                this.httpService.post(TIKTOK_TRACK_URL, payload, {
                    headers: {
                        'Access-Token': accessToken,
                        'Content-Type': 'application/json',
                    },
                }),
            );
            return { forwarded: true };
        } catch (error: unknown) {
            // Log server-side for observability, scrubbed of the token and any
            // hashed PII (we only surface TikTok's own error envelope + status).
            this.logTikTokError(pixelId, error);
            return { forwarded: false };
        }
    }

    private buildPayload(
        pixelId: string,
        tiktokEventName: string,
        dto: CapiEventDto,
        ctx: TikTokRequestContext,
        testEventCode: string | null | undefined,
    ): Record<string, unknown> {
        const user: Record<string, unknown> = {};

        const hashedEmail = normalizeAndHash(dto.userData?.email);
        if (hashedEmail) user.email = hashedEmail;

        const hashedPhone = normalizeAndHash(dto.userData?.phone);
        if (hashedPhone) user.phone_number = hashedPhone;

        const hashedExternalId = normalizeAndHash(dto.userData?.externalId);
        if (hashedExternalId) user.external_id = hashedExternalId;

        if (ctx.ip) user.ip = ctx.ip;
        if (ctx.userAgent) user.user_agent = ctx.userAgent;
        if (dto.ttp) user.ttp = dto.ttp;
        if (dto.ttclid) user.ttclid = dto.ttclid;

        const event: Record<string, unknown> = {
            event: tiktokEventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: dto.eventId,
            user,
        };
        if (dto.customData) event.properties = dto.customData;
        if (dto.eventSourceUrl) event.page = { url: dto.eventSourceUrl };

        const payload: Record<string, unknown> = {
            event_source: 'web',
            event_source_id: pixelId,
            data: [event],
        };
        if (testEventCode) payload.test_event_code = testEventCode;

        return payload;
    }

    private logTikTokError(pixelId: string, error: unknown): void {
        const axiosLike = error as {
            response?: { status?: number; data?: unknown };
            message?: string;
        };
        const status = axiosLike.response?.status;
        // TikTok's error body carries no token/PII — safe to log for debugging.
        const body = axiosLike.response?.data ?? axiosLike.message ?? 'unknown error';
        this.logger.warn(
            `TikTok Events API forward failed for pixel ${pixelId} (status ${status ?? 'n/a'}): ${JSON.stringify(body)}`,
        );
    }
}
