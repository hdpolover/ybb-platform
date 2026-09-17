// Announcement URL slug helpers for the editor.
//
// toAnnouncementSlug mirrors the API's services/api/src/shared/utils/url-slug.ts
// toUrlSlug so the slug previewed while typing a title is the slug the API would
// generate. The API stays the authority: it validates the pattern again, adds
// -2/-3 suffixes for generated slugs, and 409s a taken explicit one.
//
// No "use client" on purpose: plain helpers, importable from anywhere.

export const ANNOUNCEMENT_SLUG_MAX_LENGTH = 200;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toAnnouncementSlug(input: string): string {
  return (input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ANNOUNCEMENT_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Returns a message for an invalid slug, or null when it is acceptable.
 * An empty slug is only valid on create, where the API generates one.
 */
export function validateAnnouncementSlug(slug: string, opts: { allowEmpty: boolean }): string | null {
  if (!slug) {
    return opts.allowEmpty ? null : "Slug is required.";
  }
  if (slug.length > ANNOUNCEMENT_SLUG_MAX_LENGTH) {
    return `Slug must be at most ${ANNOUNCEMENT_SLUG_MAX_LENGTH} characters.`;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "Slug may only use lowercase letters, numbers and single hyphens, and cannot start or end with a hyphen.";
  }
  if (UUID_PATTERN.test(slug)) {
    return "Slug cannot look like an ID.";
  }
  return null;
}

/** Public path the slug is served at on the participant site. */
export function announcementPublicPath(slug: string): string {
  return `/announcements/${slug}`;
}

/** Friendly text for the API's 409 on a taken slug; null for any other error. */
export function slugConflictMessage(error: unknown, slug: string): string | null {
  const status = (error as { status?: unknown } | null)?.status;
  if (status !== 409) return null;
  return slug
    ? `The slug "${slug}" is already used by another announcement. Choose a different slug.`
    : "That slug is already used by another announcement. Choose a different slug.";
}
