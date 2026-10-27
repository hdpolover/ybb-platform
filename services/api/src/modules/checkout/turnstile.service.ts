// services/api/src/modules/checkout/turnstile.service.ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5000;

@Injectable()
export class TurnstileService {
    private readonly logger = new Logger(TurnstileService.name);

    constructor(private readonly config: ConfigService) {}

    isConfigured(): boolean {
        return Boolean(this.config.get<string>('TURNSTILE_SECRET_KEY'));
    }

    /**
     * true = challenge passed, false = rejected by Cloudflare. Throws 503 when we
     * could not get an answer at all: failing closed, but not blaming the user.
     */
    async verify(token: string, remoteIp?: string): Promise<boolean> {
        const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
        if (!secret) throw new ServiceUnavailableException('Checkout is temporarily unavailable.');

        const body = new URLSearchParams({ secret, response: token });
        if (remoteIp && remoteIp !== '0.0.0.0') body.set('remoteip', remoteIp);

        try {
            const res = await fetch(SITEVERIFY_URL, {
                method: 'POST',
                body,
                signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
            const json = (await res.json()) as { success?: boolean };
            return json.success === true;
        } catch (error) {
            this.logger.error(`Turnstile verification unavailable: ${(error as Error).message}`);
            throw new ServiceUnavailableException('Checkout is temporarily unavailable.');
        }
    }
}
