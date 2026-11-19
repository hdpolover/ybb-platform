// services/admin-dashboard/lib/contact-links.ts
// Safe link builders for free-text participant contact values.

export interface InstagramLink {
  display: string;
  href: string | null;
}

const HANDLE_RE = /^@?([A-Za-z0-9._]{1,30})$/;
const IG_URL_RE = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i;

export function isHttpUrl(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\/\S+$/i.test(value.trim());
}

/** wa.me link for an international number ("+" prefix, 8-15 digits); null otherwise. */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const v = (phone ?? "").trim();
  if (!v.startsWith("+")) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

/** Instagram free text -> display + href. Never builds a URL from a name with spaces. */
export function instagramLink(raw: string | null | undefined): InstagramLink {
  const v = (raw ?? "").trim();
  if (!v) return { display: "", href: null };
  if (isHttpUrl(v)) {
    const handle = IG_URL_RE.exec(v)?.[1];
    return handle ? { display: `@${handle}`, href: v } : { display: v, href: null };
  }
  const handle = HANDLE_RE.exec(v)?.[1];
  if (!handle) return { display: v, href: null };
  return { display: `@${handle}`, href: `https://www.instagram.com/${handle}/` };
}
