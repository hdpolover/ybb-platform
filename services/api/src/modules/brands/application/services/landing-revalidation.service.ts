import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

/**
 * Nudge a brand's landing Next.js app to drop its server-side `unstable_cache`
 * entries for settings and/or home. Each brand lives at its own domain (read
 * from `brand.websiteUrl`), so we resolve the target URL per call.
 *
 * Resolution order:
 *   1. Explicit `landingUrl` argument (used by delete where the row is gone)
 *   2. `brand.websiteUrl` from the DB
 *   3. `LANDING_URL` env var fallback (dev, shared landing, or override)
 *
 * Env:
 *   LANDING_URL                — optional fallback / override.
 *   SETTINGS_REVALIDATE_SECRET — shared secret matching the landing settings
 *                                revalidation route. Optional; the route
 *                                treats missing secret as "open" for dev.
 *   HOME_REVALIDATE_SECRET     — shared secret matching the landing home
 *                                revalidation route. Optional; same dev
 *                                semantics as above.
 *
 * Failures are logged and swallowed: the brand/program save already succeeded,
 * and the landing's TTL is the safety net. A bad revalidate shouldn't 500 the
 * admin request.
 */
@Injectable()
export class LandingRevalidationService {
    private readonly logger = new Logger(LandingRevalidationService.name);
    private readonly fallbackLandingUrl: string;
    private readonly revalidateSecret: string;
    private readonly homeRevalidateSecret: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.fallbackLandingUrl = this.configService.get<string>('LANDING_URL', '').trim();
        this.revalidateSecret = this.configService.get<string>('SETTINGS_REVALIDATE_SECRET', '').trim();
        this.homeRevalidateSecret = this.configService.get<string>('HOME_REVALIDATE_SECRET', '').trim();
    }

    /**
     * Revalidate for a specific brand. Resolves the target URL from the first
     * source that yields a usable http(s) origin:
     *   1. `explicit` argument (caller has fresh values in hand)
     *   2. `brand.landingUrl` — the canonical landing deployment URL
     *   3. `brand.websiteUrl` — legacy fallback for brands that haven't set
     *      landingUrl yet
     *   4. `LANDING_URL` env var — dev/shared deployments
     */
    async revalidateForBrand(
        brandId: string,
        explicit?: { landingUrl?: string | null; websiteUrl?: string | null } | null,
    ): Promise<void> {
        let target = this.normalize(explicit?.landingUrl) ?? this.normalize(explicit?.websiteUrl);
        if (!target) {
            try {
                const brand = await this.prisma.brand.findUnique({
                    where: { id: brandId },
                    // Fall back to websiteUrl for rows created before the admin
                    // started filling landingUrl explicitly.
                    select: { landingUrl: true, websiteUrl: true },
                });
                target = this.normalize(brand?.landingUrl) ?? this.normalize(brand?.websiteUrl);
            } catch (err) {
                this.logger.warn(`Failed to look up brand landing URL for ${brandId}: ${(err as Error)?.message ?? err}`);
            }
        }
        if (!target) target = this.normalize(this.fallbackLandingUrl);
        if (!target) {
            this.logger.debug(`No landing URL configured for brand ${brandId} — skipping revalidation.`);
            return;
        }
        const brandDomain = new URL(target).host;
        await this.post(target, 'settings', this.revalidateSecret, brandDomain);
    }

    /**
     * Revalidate for an already-known landing URL. Useful when the caller
     * already has it in memory (e.g. delete handlers that captured it before
     * removing the brand row).
     */
    async revalidateLandingUrl(landingUrl: string | null | undefined): Promise<void> {
        const target = this.normalize(landingUrl) ?? this.normalize(this.fallbackLandingUrl);
        if (!target) return;
        await this.post(target, 'settings', this.revalidateSecret);
    }

    /**
     * Revalidate both the home and settings pages for a brand. Used when a
     * program is updated so that the participant frontend reflects the change
     * immediately rather than waiting for the cache TTL.
     *
     * Resolves the brand's base URL then fires two requests in parallel:
     *   POST /api/home/revalidate?brandDomain=<host>
     *   POST /api/settings/revalidate?brandDomain=<host>
     *
     * Both requests are scoped to the brand via the `brandDomain` query param.
     * Failures are swallowed individually so one failing route does not
     * suppress the other.
     */
    async revalidateHomeAndSettingsForBrand(brandId: string): Promise<void> {
        const base = await this.resolveBaseUrl(brandId);
        if (!base) {
            this.logger.debug(`No landing URL configured for brand ${brandId} — skipping home+settings revalidation.`);
            return;
        }
        const brandDomain = new URL(base).host;
        await Promise.all([
            this.post(base, 'settings', this.revalidateSecret, brandDomain),
            this.post(base, 'home', this.homeRevalidateSecret, brandDomain),
        ]);
    }

    /**
     * Resolve the base landing URL for a brand. Returns null when no usable
     * URL can be found.
     */
    private async resolveBaseUrl(brandId: string, explicit?: string): Promise<string | null> {
        if (explicit) {
            const normalized = this.normalize(explicit);
            if (normalized) return normalized;
        }
        try {
            const brand = await this.prisma.brand.findUnique({
                where: { id: brandId },
                select: { landingUrl: true, websiteUrl: true },
            });
            const fromBrand = this.normalize(brand?.landingUrl) ?? this.normalize(brand?.websiteUrl);
            if (fromBrand) return fromBrand;
        } catch (err) {
            this.logger.warn(`Failed to look up brand landing URL for ${brandId}: ${(err as Error)?.message ?? err}`);
        }
        return this.normalize(this.fallbackLandingUrl);
    }

    private async post(
        baseUrl: string,
        route: 'home' | 'settings',
        secret: string,
        brandDomain?: string,
    ): Promise<void> {
        const qs = brandDomain ? `?brandDomain=${encodeURIComponent(brandDomain)}` : '';
        const url = `${baseUrl}/api/${route}/revalidate${qs}`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const hasSecret = Boolean(secret);
        if (hasSecret) {
            headers['Authorization'] = `Bearer ${secret}`;
        }

        try {
            await firstValueFrom(
                this.httpService.post(url, {}, { headers }).pipe(
                    timeout(3000),
                    catchError((err) => {
                        // 401 here means the landing app's secret doesn't match
                        // the value we sent (or we sent none). Surface that hint
                        // in the log so the next failure line points directly at
                        // the env var to fix.
                        const status = err?.response?.status;
                        const secretName = route === 'home' ? 'HOME_REVALIDATE_SECRET' : 'SETTINGS_REVALIDATE_SECRET';
                        const hint =
                            status === 401
                                ? hasSecret
                                    ? ` — ${secretName} on the API does not match the value on the landing app`
                                    : ` — ${secretName} is not set on the API but the landing app requires it`
                                : '';
                        this.logger.warn(
                            `Landing revalidation failed (${url}): ${err?.message ?? err}${hint}`,
                        );
                        return of(null);
                    }),
                ),
            );
        } catch (err) {
            this.logger.warn(`Landing revalidation threw: ${(err as Error)?.message ?? err}`);
        }
    }

    // Trim, strip trailing slash, require an http(s) scheme. Returns null on
    // anything not usable so callers don't send malformed requests to garbage.
    private normalize(raw: string | null | undefined): string | null {
        if (!raw) return null;
        const trimmed = raw.trim().replace(/\/$/, '');
        if (!trimmed) return null;
        if (!/^https?:\/\//i.test(trimmed)) return null;
        return trimmed;
    }
}
