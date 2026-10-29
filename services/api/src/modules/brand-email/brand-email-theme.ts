// src/modules/brand-email/brand-email-theme.ts
import { ButtonStyle } from './dto/brand-email-theme.dto';

export const NEUTRAL_COLOR = '#1F2937';
export const DEFAULT_FROM_DOMAIN = 'news.youthbreaktheboundaries.com';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Stored theme fields (all optional) - the validated DTO shape. */
export interface StoredEmailTheme {
    fromName?: string;
    fromLocalPart?: string;
    replyTo?: string;
    bannerUrl?: string;
    footerText?: string;
    secondaryColor?: string;
    accentColor?: string;
    buttonStyle?: ButtonStyle;
}

export interface BrandEmailSource {
    name: string;
    slug: string;
    tagline?: string | null;
    websiteUrl?: string | null;
    primaryColor?: string | null;
    logoUrl?: string | null;
    socialMediaLinks?: unknown;
    supportEmail?: string | null;
}

/** Every value resolved; the renderer and Listmonk client only see this. */
export interface EffectiveEmailTheme {
    brandName: string;
    tagline: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    socialLinks: Array<{ label: string; url: string }>;
    fromName: string;
    fromLocalPart: string;
    replyTo: string | null;
    bannerUrl: string | null;
    footerText: string;
    primaryColor: string;
    secondaryColor: string;
    /** Top bar + divider: stored accent, else brand primary, else neutral. */
    accentColor: string;
    buttonStyle: ButtonStyle;
}

const hexOr = (value: string | null | undefined, fallback: string): string =>
    value && HEX_COLOR.test(value) ? value : fallback;

function normalizeSocialLinks(raw: unknown): Array<{ label: string; url: string }> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    return Object.entries(raw as Record<string, unknown>)
        .filter(([, url]) => typeof url === 'string' && url.length > 0)
        .map(([label, url]) => ({ label, url: url as string }));
}

function defaultLocalPart(slug: string): string {
    const cleaned = slug.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 31);
    return cleaned || 'news';
}

/** Slug is already [a-z0-9-]; fall back to it when the stored local part is unset. */
export function resolveEmailTheme(brand: BrandEmailSource, stored: StoredEmailTheme | null | undefined): EffectiveEmailTheme {
    const theme = stored ?? {};
    const primaryColor = hexOr(brand.primaryColor, NEUTRAL_COLOR);
    return {
        brandName: brand.name,
        tagline: brand.tagline ?? null,
        websiteUrl: brand.websiteUrl ?? null,
        logoUrl: brand.logoUrl ?? null,
        socialLinks: normalizeSocialLinks(brand.socialMediaLinks),
        fromName: theme.fromName || brand.name,
        fromLocalPart: theme.fromLocalPart || defaultLocalPart(brand.slug),
        replyTo: theme.replyTo || brand.supportEmail || null,
        bannerUrl: theme.bannerUrl || null,
        footerText: theme.footerText || '',
        primaryColor,
        secondaryColor: hexOr(theme.secondaryColor, primaryColor),
        accentColor: hexOr(theme.accentColor, primaryColor),
        buttonStyle: theme.buttonStyle ?? 'rounded',
    };
}
