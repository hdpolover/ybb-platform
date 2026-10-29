// src/modules/brand-email/brand-email-template.renderer.ts
import { ButtonStyle } from './dto/brand-email-theme.dto';
import { EffectiveEmailTheme } from './brand-email-theme';

/** Listmonk (Go template) tokens the renderer emits. Everything else admin-supplied is escaped. */
export const CONTENT_TOKEN = '{{ template "content" . }}';
export const UNSUBSCRIBE_TOKEN = '{{ UnsubscribeURL }}';

const ORGANIZER_LINE = 'Organized by Youth Break the Boundaries (YBB)';
const BUTTON_RADIUS: Record<ButtonStyle, string> = { rounded: '6px', square: '0', pill: '999px' };
const FONT = "Arial, Helvetica, sans-serif";

/**
 * Escapes HTML and also neutralises '{' / '}' so an admin value can never
 * inject Listmonk Go-template actions (e.g. "{{ .Subscriber.Email }}").
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\{/g, '&#123;')
        .replace(/\}/g, '&#125;');
}

/** Returns a normalised https URL or null (rejects javascript:, data:, http:, garbage). */
export function safeHttpsUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
}

const safeHex = (value: string, fallback: string): string => (/^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback);

/** Bulletproof-ish button: table cell carries the background so Outlook paints it too. */
export function renderCtaButton(theme: EffectiveEmailTheme, label: string, url: string): string {
    const href = safeHttpsUrl(url);
    if (!href) return '';
    const color = safeHex(theme.secondaryColor, '#1F2937');
    const radius = BUTTON_RADIUS[theme.buttonStyle] ?? BUTTON_RADIUS.rounded;
    return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>` +
        `<td align="center" bgcolor="${color}" style="background-color:${color};border-radius:${radius};">` +
        `<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:${radius};">${escapeHtml(label)}</a>` +
        `</td></tr></table>`
    );
}

function renderHeader(theme: EffectiveEmailTheme): string {
    const rows: string[] = [];
    const logo = safeHttpsUrl(theme.logoUrl);
    const banner = safeHttpsUrl(theme.bannerUrl);
    const name = escapeHtml(theme.brandName);
    if (logo) {
        rows.push(
            `<tr><td align="center" style="padding:20px 24px 12px 24px;"><img src="${escapeHtml(logo)}" alt="${name}" height="48" style="display:block;border:0;outline:none;height:48px;max-width:240px;width:auto;"></td></tr>`,
        );
    } else {
        rows.push(
            `<tr><td align="center" style="padding:24px;font-family:${FONT};font-size:22px;font-weight:bold;color:#111827;">${name}</td></tr>`,
        );
    }
    if (banner) {
        rows.push(
            `<tr><td style="padding:0;"><img src="${escapeHtml(banner)}" alt="" width="600" style="display:block;border:0;outline:none;width:100%;max-width:600px;height:auto;"></td></tr>`,
        );
    }
    return rows.join('');
}

function renderFooter(theme: EffectiveEmailTheme): string {
    const secondary = safeHex(theme.secondaryColor, '#1F2937');
    const linkStyle = `color:${secondary};text-decoration:underline;`;
    const parts: string[] = [];

    const site = safeHttpsUrl(theme.websiteUrl);
    const socials = theme.socialLinks
        .map((s) => ({ label: s.label, url: safeHttpsUrl(s.url) }))
        .filter((s): s is { label: string; url: string } => s.url !== null)
        .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" style="${linkStyle}">${escapeHtml(s.label.charAt(0).toUpperCase() + s.label.slice(1))}</a>`);
    if (site) socials.unshift(`<a href="${escapeHtml(site)}" target="_blank" style="${linkStyle}">Website</a>`);
    if (socials.length) {
        parts.push(`<p style="margin:0 0 12px 0;">${socials.join(' &nbsp;|&nbsp; ')}</p>`);
    }

    if (theme.footerText.trim()) {
        parts.push(`<p style="margin:0 0 12px 0;">${escapeHtml(theme.footerText.trim()).replace(/\r?\n/g, '<br>')}</p>`);
    }
    parts.push(`<p style="margin:0 0 12px 0;">${ORGANIZER_LINE}</p>`);
    parts.push(
        `<p style="margin:0;">You are receiving this because you registered for a ${escapeHtml(theme.brandName)} program. ` +
            `<a href="${UNSUBSCRIBE_TOKEN}" style="${linkStyle}">Unsubscribe</a></p>`,
    );

    return (
        `<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:2px solid ${safeHex(theme.primaryColor, '#1F2937')};font-size:0;line-height:0;height:2px;">&nbsp;</td></tr></table></td></tr>` +
        `<tr><td style="padding:20px 32px 28px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:#6b7280;">${parts.join('')}</td></tr>`
    );
}

/** Pure: effective theme -> Listmonk campaign template HTML. */
export function renderBrandEmailTemplate(theme: EffectiveEmailTheme): string {
    const primary = safeHex(theme.primaryColor, '#1F2937');
    const secondary = safeHex(theme.secondaryColor, primary);
    const title = escapeHtml(theme.brandName);

    return (
        `<!DOCTYPE html>\n<html lang="en" xmlns="http://www.w3.org/1999/xhtml">\n<head>\n` +
        `<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
        `<meta http-equiv="X-UA-Compatible" content="IE=edge">\n<title>${title}</title>\n` +
        `<style type="text/css">body{margin:0;padding:0;}table{border-collapse:collapse;}img{-ms-interpolation-mode:bicubic;}` +
        `.content a{color:${secondary};}@media only screen and (max-width:620px){.container{width:100% !important;}}</style>\n</head>\n` +
        `<body style="margin:0;padding:0;background-color:#f4f4f5;">\n` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;"><tr><td align="center" style="padding:24px 12px;">\n` +
        `<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;">\n` +
        `<tr><td bgcolor="${primary}" style="background-color:${primary};font-size:0;line-height:0;height:6px;">&nbsp;</td></tr>\n` +
        `${renderHeader(theme)}\n` +
        `<tr><td class="content" style="padding:24px 32px;font-family:${FONT};font-size:16px;line-height:24px;color:#1f2937;">${CONTENT_TOKEN}</td></tr>\n` +
        `${renderFooter(theme)}\n` +
        `</table>\n</td></tr></table>\n</body>\n</html>\n`
    );
}

/** Fills the Listmonk tokens with sample data so an admin iframe shows a realistic mail. */
export function renderPreviewHtml(theme: EffectiveEmailTheme): string {
    const sample =
        `<h1 style="margin:0 0 16px 0;font-size:24px;line-height:30px;color:#111827;">Applications are now open</h1>` +
        `<p style="margin:0 0 16px 0;">Hi Alex, this is sample content so you can see how your ${escapeHtml(theme.brandName)} emails will look. ` +
        `Replace it with your own message in the campaign editor.</p>` +
        `<p style="margin:0 0 24px 0;">Here is a <a href="https://example.com">sample link</a> inside the body.</p>` +
        renderCtaButton(theme, 'Apply now', safeHttpsUrl(theme.websiteUrl) ?? 'https://example.com');
    return renderBrandEmailTemplate(theme).replace(CONTENT_TOKEN, sample).replace(UNSUBSCRIBE_TOKEN, '#');
}
