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

/**
 * True iff a storage key (as returned by deriveStorageKeyFromUrl) was minted
 * under this program's own path segment:
 *   '{env}/{brandId}/programs/{programId}/{category}/{filename}'
 * (see services/file's FilePathService.get_storage_path "Program Global" case).
 *
 * Audit M17: the presigner (PrivateFileUrlResolver) presigns whatever key it's
 * handed with no ownership check of its own - it's a dumb "derive key, ask the
 * file service to sign it" helper reused for every stored-url field in the
 * codebase, so ownership can't live there without threading program/brand
 * context through every one of its callers. Instead, any write path that lets
 * a caller submit an arbitrary templateUrl (rather than always deriving it
 * from an uploaded file) must call this before persisting the url, or an
 * admin scoped to one program could reference another program's/brand's
 * private document by pasting its CDN url.
 */
export function storageKeyBelongsToProgram(storageKey: string, programId: string): boolean {
  const segments = storageKey.split('/').filter(Boolean);
  const programsIndex = segments.indexOf('programs');
  if (programsIndex === -1) return false;
  return segments[programsIndex + 1] === programId;
}
