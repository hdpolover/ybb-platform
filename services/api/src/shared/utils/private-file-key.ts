// Storage-path helpers for the private-file presign path (documents, signed-copies).
// Keep host-agnostic: derive the object key from the first /prod|staging|dev/ segment
// rather than hardcoding the CDN host, so a host/CDN change can't silently break this.

const ENV_SEGMENT_PATTERN = /\/(prod|staging|dev)\/(.+)$/;

const PRIVATE_CATEGORIES = new Set(['documents', 'signed-copies']);

// Content-based fallback for when ENV_SEGMENT_PATTERN can't parse a url (e.g. host/path
// format changed) but the url still visibly lives under a private category folder.
const PRIVATE_CATEGORY_SEGMENT_PATTERN = /\/(documents|signed-copies)\//i;

/**
 * Recover the storage object key from a stored CDN url, e.g.
 *   https://cdn.ybbhub.com/prod/{brand}/programs/{program}/documents/{fileid}.ext
 *   -> 'prod/{brand}/programs/{program}/documents/{fileid}.ext'
 *
 * Returns null if no /prod|staging|dev/ segment is found (e.g. already-masked
 * download-proxy urls, or urls that aren't ours).
 */
export function deriveStorageKeyFromUrl(url: string): string | null {
  const match = ENV_SEGMENT_PATTERN.exec(url);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

/**
 * True iff the storage key's category segment (second-to-last path segment,
 * i.e. the folder the file lives directly under) is a private category.
 */
export function isPrivateCategoryKey(storageKey: string): boolean {
  const segments = storageKey.split('/').filter(Boolean);
  if (segments.length < 2) return false;
  const category = segments[segments.length - 2];
  return PRIVATE_CATEGORIES.has(category);
}

/**
 * Fail-closed fallback for callers of deriveStorageKeyFromUrl(): when the env-segment
 * regex can't parse a url (returns null) but the raw url string still contains a
 * `/documents/` or `/signed-copies/` path segment, treat it as private rather than
 * silently letting it fall through as "not private".
 */
export function looksLikePrivateCategoryUrl(url: string): boolean {
  return PRIVATE_CATEGORY_SEGMENT_PATTERN.test(url);
}
