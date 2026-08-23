// file: services/api/src/shared/constants/cache-patterns.spec.ts
import { LANDING_BRAND_PATTERNS, PROGRAM_CONTENT_PATTERNS } from './cache-patterns';

describe('cache-patterns', () => {
  // A 2026-08-23 audit found every @CacheInvalidate route clearing the page
  // caches but leaving `landing:snapshot:*` untouched. That is the one layer
  // LandingSnapshotService falls back to when Redis misses, so the stale
  // payload came straight back out on the next request and admins saw their
  // edit "not save". CacheService.invalidateBrandLandingCaches always cleared
  // it; only the decorator's pattern list was missing it.
  it('busts the landing snapshot layer, not just the page caches', () => {
    expect(LANDING_BRAND_PATTERNS).toContain('landing:snapshot:*');
  });

  it('carries the snapshot pattern through to program-content routes', () => {
    expect(PROGRAM_CONTENT_PATTERNS).toContain('landing:snapshot:*');
  });
});
