// src/modules/users/application/utils/account-deletion-cancel-url.util.ts
import { ConfigService } from '@nestjs/config';

// Mirrors the baseUrl resolution in forgot-password.handler.ts /
// register.handler.ts: brand.websiteUrl wins when known (the participant
// clicks through on the brand domain they registered on), FRONTEND_URL is
// the fallback.
export function buildAccountDeletionCancelUrl(
    configService: ConfigService,
    brand: { websiteUrl?: string | null } | null,
    requestId: string,
    token: string,
): string {
    let baseUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    if (brand?.websiteUrl) {
        baseUrl = brand.websiteUrl.replace(/\/$/, '');
    }
    const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
    return `${normalizedBaseUrl.replace(/\/$/, '')}/auth/cancel-deletion?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(token)}`;
}
