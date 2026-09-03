import { CacheService } from '@shared/infrastructure/cache/cache.service';

/**
 * A CacheService double with every public method stubbed.
 *
 * Derived from the real class's prototype rather than hand-written, which is the
 * whole point: a method added to CacheService appears here automatically. A
 * hand-built literal cannot do that, and the failure is SILENT - every handler
 * that invalidates caches wraps the call in try/catch and logs, because
 * invalidation must never fail the write that triggered it. So a spec whose mock
 * lacks a method still PASSES while exercising none of the invalidation path,
 * and reports green on behaviour it never ran.
 *
 * Not hypothetical: specs were emitting
 * "TypeError: this.cacheService.invalidatePortalCache is not a function" into
 * the CI log on every run, from mocks written before that method existed.
 *
 * Same family as the missing scope fixture in N17 - there a persona no fixture
 * represented, here a method no mock implements. Both are invisible in a green
 * suite, because absence does not fail; it just never asks.
 *
 * @param overrides stub specific methods, e.g. { get: jest.fn().mockResolvedValue(cached) }
 */
export function createCacheServiceMock(
  overrides: Partial<Record<keyof CacheService, unknown>> = {},
): jest.Mocked<CacheService> & Record<string, jest.Mock> {
  const prototype = CacheService.prototype as unknown as Record<string, unknown>;
  const double: Record<string, unknown> = {};

  for (const name of Object.getOwnPropertyNames(prototype)) {
    if (name === 'constructor') continue;
    if (typeof prototype[name] !== 'function') continue;
    // Every CacheService method returns a promise, and undefined is the honest
    // default for `get` too - it is a cache miss.
    double[name] = jest.fn().mockResolvedValue(undefined);
  }

  // Double cast: the double carries only the public methods, while
  // jest.Mocked<CacheService> also names the private fields. Specs are typed
  // against the public surface, which is all a consumer can call anyway.
  return Object.assign(double, overrides) as unknown as jest.Mocked<CacheService> &
    Record<string, jest.Mock>;
}
