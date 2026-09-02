// services/admin-dashboard/lib/sanitize-html.ts
/**
 * Single sanitizer for every admin-authored rich-text field rendered via
 * dangerouslySetInnerHTML (payment info, T&Cs, announcements, LoA layouts,
 * support ticket bodies, program descriptions, ...).
 *
 * Uses isomorphic-dompurify so the same call is safe during SSR (no window)
 * and in the browser, rather than a hand-rolled regex allowlist that a
 * malformed/nested tag can slip past.
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "blockquote", "code", "pre",
  "h1", "h2", "h3", "h4", "a", "span", "div", "img", "table", "thead",
  "tbody", "tr", "th", "td", "hr",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "target", "rel", "style"];

/** Narrower allowlist for plain-text-ish content (support ticket messages). */
export const TEXT_ONLY_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "code", "pre",
];

// DOMPurify does not parse CSS, so an unrestricted `style` attribute could carry
// javascript:/expression() payloads. The rich-text editor only ever emits
// text-align and color, so keep just those two properties with safe values.
const SAFE_STYLE_DECL = /^(text-align:\s*(left|right|center|justify)|color:\s*(#[0-9a-f]{3,8}|rgb\([\d,\s]+\)|[a-z]+))$/i;

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style") return;
  const kept = data.attrValue
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => decl && SAFE_STYLE_DECL.test(decl));
  data.attrValue = kept.join("; ");
});

/** Sanitize admin-authored HTML before it is passed to dangerouslySetInnerHTML. */
export function sanitizeHtml(
  value: string | null | undefined,
  opts?: { allowedTags?: string[] },
): string {
  if (!value || !value.trim()) return "";
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: opts?.allowedTags ?? ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
