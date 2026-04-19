import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

/**
 * Nudge a brand's landing Next.js app to drop its server-side `unstable_cache`
 * entry for settings. Each brand lives at its own domain (read from
 * `brand.websiteUrl`), so we resolve the target URL per call.
 *
 * Resolution order:
 *   1. Explicit `landingUrl` argument (used by delete where the row is gone)
 *   2. `brand.websiteUrl` from the DB
 *   3. `LANDING_URL` env var fallback (dev, shared landing, or override)
 *
 * Env:
 *   LANDING_URL                — optional fallback / override.
 *   SETTINGS_REVALIDATE_SECRET — shared secret matching the landing route.
 *                                Optional; the route treats missing secret as
 *                                "open" for dev.
 *
 * Failures are logged and swallowed: the brand save already succeeded, and the
 * landing's 60s TTL is the safety net. A bad revalidate shouldn't 500 the
 * admin request.
 */
@Injectable()
export class LandingRevalidationService {
    private readonly logger = new Logger(LandingRevalidationService.name);
    private readonly fallbackLandingUrl: string;
    private readonly revalidateSecret: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.fallbackLandingUrl = this.configService.get<string>('LANDING_URL', '').trim();
        this.revalidateSecret = this.configService.get<string>('SETTINGS_REVALIDATE_SECRET', '').trim();
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
        await this.post(target);
    }

    /**
     * Revalidate for an already-known landing URL. Useful when the caller
     * already has it in memory (e.g. delete handlers that captured it before
     * removing the brand row).
     */
    async revalidateLandingUrl(landingUrl: string | null | undefined): Promise<void> {
        const target = this.normalize(landingUrl) ?? this.normalize(this.fallbackLandingUrl);
        if (!target) return;
        await this.post(target);
    }

    private async post(baseUrl: string): Promise<void> {
        const url = `${baseUrl}/api/settings/revalidate`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.revalidateSecret) {
            headers['Authorization'] = `Bearer ${this.revalidateSecret}`;
        }

        try {
            await firstValueFrom(
                this.httpService.post(url, {}, { headers }).pipe(
                    timeout(3000),
                    catchError((err) => {
                        this.logger.warn(`Landing revalidation failed (${url}): ${err?.message ?? err}`);
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
