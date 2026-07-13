import { BrandSetting } from '@core/entities/brand-setting.entity';

/**
 * Converts a BrandSetting entity into a plain object safe for API responses.
 *
 * BrandSetting carries `capiAccessToken` — a Meta Conversions API secret. Every
 * brand read/write response DTO types `settings` as `Record<string, unknown>`
 * and historically built it via a raw `as unknown as Record<string, unknown>`
 * cast of the entity, which would silently leak the token to the admin
 * dashboard browser. Route all `settings` response fields through this helper
 * instead of casting the entity directly.
 *
 * Only `capiAccessToken` is stripped. `capiTestEventCode` is NOT a secret and
 * is intentionally passed through as-is so the admin UI can display/edit it.
 */
export function toSafeBrandSettingsResponse(
    settings: BrandSetting | null | undefined,
): Record<string, unknown> | null {
    if (!settings) return null;

    // capiTestEventCode stays in safeFields (non-secret, shown normally).
    const { capiAccessToken, ...safeFields } = settings;

    return {
        ...safeFields,
        hasCapiAccessToken: Boolean(capiAccessToken),
    };
}
