import {
    BadRequestException,
    Body,
    Controller,
    ForbiddenException,
    HttpStatus,
    Post,
    Req,
    Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../shared/decorators/public.decorator';
import { cleanDomain } from '../../shared/decorators/brand-domain.decorator';
import { LandingService } from '../landing/landing.service';
import { CapiEventDto } from './dto/capi-event.dto';
import { ALLOWED_EVENT_NAMES, MetaCapiService } from './meta-capi.service';

@ApiTags('Meta CAPI')
@Controller('meta')
@Public()
export class MetaCapiController {
    constructor(
        private readonly metaCapiService: MetaCapiService,
        private readonly landingService: LandingService,
    ) {}

    // Uses raw @Res() (bypassing the global TransformInterceptor envelope, same
    // pattern as WebhooksController) because this route must return a bare
    // 200/204 with no body — exactly what a `navigator.sendBeacon`/`fetch`
    // pixel caller expects, not a wrapped `{ statusCode, message, data }` JSON
    // envelope. Exception filters still apply normally for the 400/403 paths.
    @Post('capi')
    @ApiOperation({
        summary: 'Forward a browser event to Meta Conversions API',
        description:
            'Public, browser-facing relay for Meta CAPI. Resolves the calling brand from the ' +
            'request Origin/Referer, loads that brand\'s pixel + access token from brand ' +
            'settings, and forwards a server-side event to Meta. Never throws to the client ' +
            'on Graph API failures — analytics must never break the page.',
    })
    @ApiResponse({ status: 200, description: 'Event forwarded to Meta.' })
    @ApiResponse({ status: 204, description: 'No-op — brand has no CAPI configured, or the event was rate-limited.' })
    @ApiResponse({ status: 400, description: 'Unknown/unsupported eventName.' })
    @ApiResponse({ status: 403, description: 'Request origin does not resolve to a known brand.' })
    async capi(@Body() dto: CapiEventDto, @Req() req: Request, @Res() res: Response): Promise<void> {
        if (!ALLOWED_EVENT_NAMES.has(dto.eventName)) {
            throw new BadRequestException(`Unsupported eventName: ${dto.eventName}`);
        }

        const host = this.extractHost(req);
        if (!host) {
            throw new ForbiddenException('Missing or invalid request origin');
        }

        const brand = await this.landingService.resolveBrand(host).catch(() => null);
        if (!brand) {
            throw new ForbiddenException('Request origin does not resolve to a known brand');
        }

        const result = await this.metaCapiService.forwardEvent(dto, {
            host,
            ip: this.extractIp(req),
            userAgent: req.headers['user-agent'],
        });

        // Brand had no CAPI configured, or the call was rate-limited/failed —
        // no-op response. The browser-side pixel already fired regardless.
        res.status(result.forwarded ? HttpStatus.OK : HttpStatus.NO_CONTENT).end();
    }

    // Origin is preferred (set on every cross-origin fetch/XHR); Referer is the
    // fallback for browsers/requests that omit Origin on same-site navigation.
    private extractHost(req: Request): string | undefined {
        const originHeader = req.headers.origin;
        const refererHeader = req.headers.referer;
        const raw = (Array.isArray(originHeader) ? originHeader[0] : originHeader)
            ?? (Array.isArray(refererHeader) ? refererHeader[0] : refererHeader);

        if (!raw) return undefined;

        try {
            const hostname = new URL(raw).hostname;
            return cleanDomain(hostname);
        } catch {
            return undefined;
        }
    }

    // The X-Forwarded-For chain is `client, proxy1, proxy2, ...` where each hop
    // appends the address it saw. A client can prepend arbitrary values, so the
    // LEFTMOST entry is attacker-controlled — using it lets an attacker rotate a
    // fake IP per request to defeat the per-IP rate limit, and feeds garbage to
    // Meta's client_ip_address. The RIGHTMOST entry is the one our own trusted
    // ingress appended, so it's the real connecting client (assuming a single
    // trusted proxy hop, which is our deployment). If the proxy topology grows,
    // configure Express `trust proxy` to the hop count and switch to `req.ip`.
    private extractIp(req: Request): string | undefined {
        const forwardedFor = req.headers['x-forwarded-for'];
        const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
        if (header) {
            const hops = header.split(',').map((h) => h.trim()).filter(Boolean);
            if (hops.length > 0) {
                return hops[hops.length - 1];
            }
        }
        return req.ip;
    }
}
