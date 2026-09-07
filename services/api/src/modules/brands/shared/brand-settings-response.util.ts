import { BrandSetting } from '@core/entities/brand-setting.entity';

/**
 * Converts a BrandSetting entity into a plain object safe for API responses.
 *
 * BrandSetting carries two secrets: `capiAccessToken` (Meta Conversions API) and
 * `tiktokAccessToken` (TikTok Events API). Every brand read/write response DTO
 * types `settings` as `Record<string, unknown>` and historically built it via a
 * raw `as unknown as Record<string, unknown>` cast of the entity, which would
 * silently leak both tokens to the admin dashboard browser. Route all `settings`
 * response fields through this helper instead of casting the entity directly.
 *
 * Only `capiAccessToken` and `tiktokAccessToken` are stripped. `capiTestEventCode`,
 * `tiktokPixelId`, and `tiktokTestEventCode` are NOT secrets and are intentionally
 * passed through as-is so the admin UI can display/edit them.
 */
export function toSafeBrandSettingsResponse(
    settings: BrandSetting | null | undefined,
): Record<string, unknown> | null {
    if (!settings) return null;

    // capiTestEventCode/tiktokPixelId/tiktokTestEventCode stay in safeFields
    // (non-secret, shown normally).
    const { capiAccessToken, tiktokAccessToken, ...safeFields } = settings;

    return {
        ...safeFields,
        hasCapiAccessToken: Boolean(capiAccessToken),
        hasTiktokAccessToken: Boolean(tiktokAccessToken),
    };
}
