// services/api/src/shared/utils/url-slug.ts
//
// Hyphenated, URL-path slugs ("kwon-hae-suk-explores-ai"). Deliberately NOT
// shared/utils/auto-slug.ts: that one is underscore-joined and built for form
// field keys, so it would produce "kwon_hae_suk" and prefix digits with "f_".
//
// The same transform is mirrored in SQL by the migration
// 20260917120000_program_announcement_slug_unique (normalize NFKD, strip
// combining marks, non [a-z0-9] runs -> '-', trim, cap). Keep the two in step:
// a slug the backfill produced must be one this function could also produce.

/** Hard cap on a generated or admin-supplied slug. The column is VarChar(255). */
export const URL_SLUG_MAX_LENGTH = 200;

/** Lowercase alphanumeric words joined by single hyphens, no leading/trailing hyphen. */
export const URL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bounded so a pathological run of collisions cannot turn one create into
// hundreds of queries; past this a random suffix is used instead.
const MAX_SEQUENTIAL_SUFFIX = 50;
const MAX_RANDOM_SUFFIX_ATTEMPTS = 10;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * "Kwon Hae-suk Explores AI for Inclusive, Global Communities!" ->
 * "kwon-hae-suk-explores-ai-for-inclusive-global-communities".
 *
 * Accented Latin letters are folded to their base letter ("Café" -> "cafe").
 * Scripts with no ASCII decomposition (Hangul, CJK, Arabic, ...) drop out
 * entirely, so a title written only in those scripts yields "" and the caller
 * must supply a fallback.
 */
export function toUrlSlug(input: string, maxLength: number = URL_SLUG_MAX_LENGTH): string {
  return (input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

function withSuffix(base: string, suffix: string, maxLength: number): string {
  const head = base.slice(0, Math.max(1, maxLength - suffix.length)).replace(/-+$/g, '');
  return `${head}${suffix}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

export interface ResolveUniqueSlugOptions {
  /** Used when `base` slugifies to "" (e.g. an all-Hangul title). */
  fallback: () => string;
  maxLength?: number;
}

/**
 * Returns `base` if free, otherwise `base-2`, `base-3`, ... The suffix never
 * pushes the slug past `maxLength`: the base is shortened to make room.
 *
 * A UUID-shaped candidate is always skipped. Public lookups treat a UUID key
 * as an id, so a slug of that shape could never be reached by its own URL.
 */
export async function resolveUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
  options: ResolveUniqueSlugOptions,
): Promise<string> {
  const maxLength = options.maxLength ?? URL_SLUG_MAX_LENGTH;
  const root = toUrlSlug(base, maxLength) || toUrlSlug(options.fallback(), maxLength);

  const isFree = async (candidate: string) => !isUuid(candidate) && !(await exists(candidate));

  if (await isFree(root)) return root;

  for (let n = 2; n <= MAX_SEQUENTIAL_SUFFIX; n += 1) {
    const candidate = withSuffix(root, `-${n}`, maxLength);
    if (await isFree(candidate)) return candidate;
  }

  for (let attempt = 0; attempt < MAX_RANDOM_SUFFIX_ATTEMPTS; attempt += 1) {
    const candidate = withSuffix(root, `-${randomSuffix()}`, maxLength);
    if (await isFree(candidate)) return candidate;
  }

  throw new Error(`Could not find a free slug for "${root}"`);
}
