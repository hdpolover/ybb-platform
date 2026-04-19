import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * Notifies the landing Next.js app to drop its server-side `unstable_cache`
 * entry for settings. The landing also has a 60s localStorage cache which
 * expires client-side on its own — this service only fixes the server cache.
 *
 * Configured via:
 *   LANDING_URL                  — base URL of the landing deployment
 *                                  (e.g. https://chinayouthsummit.com). When
 *                                  unset, revalidation is a no-op so dev and
 *                                  preview deployments don't break.
 *   SETTINGS_REVALIDATE_SECRET   — shared secret matching the one on the
 *                                  landing route. Optional — the route treats
 *                                  missing secret as "open" for dev.
 *
 * Failures are logged but never thrown: the brand save already succeeded, and
 * stale cache expires naturally in 60s. A bad revalidate shouldn't 500 the
 * admin request.
 */
@Injectable()
export class LandingRevalidationService {
    private readonly logger = new Logger(LandingRevalidationService.name);
    private readonly landingUrl: string;
    private readonly revalidateSecret: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.landingUrl = this.configService.get<string>('LANDING_URL', '').trim();
        this.revalidateSecret = this.configService.get<string>('SETTINGS_REVALIDATE_SECRET', '').trim();
    }

    async revalidateSettings(): Promise<void> {
        if (!this.landingUrl) {
            this.logger.debug('LANDING_URL not configured — skipping settings revalidation.');
            return;
        }

        const url = `${this.landingUrl.replace(/\/$/, '')}/api/settings/revalidate`;
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
            // Defensive — should already be caught by catchError above.
            this.logger.warn(`Landing revalidation threw: ${(err as Error)?.message ?? err}`);
        }
    }
}
