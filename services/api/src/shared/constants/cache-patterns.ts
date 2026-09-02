/**
 * Cache invalidation pattern presets used with @CacheInvalidate decorator.
 *
 * See docs/CACHE_INVALIDATION.md (added in a later task) for full strategy.
 *
 * Wildcards over brandId/userId are intentional — the alternative requires
 * resolving those IDs at the controller layer, which the decorator cannot do.
 * For surgical invalidation needing DB lookups, use direct cacheService calls
 * in the CQRS handler instead.
 */

/**
 * Patterns to bust when brand-level data changes:
 * brand settings, branding/metadata, sponsors, social feeds, legal documents,
 * FAQs, system announcements.
 */
export const LANDING_BRAND_PATTERNS = [
  'landing:home:*',
  'landing:about:*',
  'landing:programs:*',
  'landing:program:*',
  'landing:partners:*',
  'landing:announcements:*',
  'landing:faqs:*',
  'landing:settings:*',
  // Without this the decorator clears every page cache but leaves the
  // snapshot, which is the layer LandingSnapshotService falls back to on a
  // Redis miss — so the stale payload is re-served immediately and the admin
  // concludes their edit did not save. CacheService.invalidateBrandLandingCaches
  // has always cleared it; only this list was missing it.
  'landing:snapshot:*',
];

/**
 * Patterns to bust when program-level content changes:
 * essays, requirements, resources, pricing tiers, validity periods, schedule,
 * speakers, partners, gallery, testimonials, FAQs, document templates,
 * program announcements, participation info, exchange rates, etc.
 *
 * Includes both public landing pages and the per-participant portal views
 * that read program data. Portal patterns are wildcards over userId —
 * accepted over-invalidation in exchange for not needing a DB lookup.
 */
export const PROGRAM_CONTENT_PATTERNS = [
  ...LANDING_BRAND_PATTERNS,
  'program:*',
  'portal:submission-detail:*',
  'portal:submissions:*',
  'portal:dashboard:*',
  'portal:payments:*',
  'portal:documents:*',
];

/**
 * Patterns to bust when program content that only ever renders on public
 * landing pages changes: FAQs, gallery, testimonials, speakers, team, partners,
 * schedule and timeline.
 *
 * Deliberately omits the `portal:*` patterns from PROGRAM_CONTENT_PATTERNS. No
 * portal read (dashboard, submissions, submission-detail, payments, documents)
 * selects any of those relations, so evicting them only cold-started every
 * participant's portal cache platform-wide on a single admin edit.
 *
 * Content that DOES reach the portal (announcements, pricing tiers, validity
 * periods, resources, essays, requirements, program settings) must keep using
 * PROGRAM_CONTENT_PATTERNS.
 */
export const PROGRAM_PUBLIC_CONTENT_PATTERNS = [
  ...LANDING_BRAND_PATTERNS,
  // Left as a wildcard on purpose: `program:detail:*` is keyed by slug OR id
  // (GET /programs/:identifier), so a program-scoped pattern would leave the
  // slug-keyed entry stale. A narrower glob costs the same SCAN anyway: SCAN
  // walks the whole keyspace regardless of MATCH.
  'program:*',
];
