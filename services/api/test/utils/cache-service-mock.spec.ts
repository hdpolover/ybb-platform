import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { createCacheServiceMock } from './cache-service-mock';

describe('createCacheServiceMock', () => {
    const realMethods = Object.getOwnPropertyNames(CacheService.prototype).filter(
        (name) =>
            name !== 'constructor' &&
            typeof (CacheService.prototype as unknown as Record<string, unknown>)[name] === 'function',
    );

    // The guarantee that makes this worth having over a literal: it tracks the
    // real class, so a method added to CacheService cannot be silently missing
    // from a spec's mock. This test fails the day someone adds one and the
    // derivation breaks.
    it('stubs every public method the real CacheService declares', () => {
        const mock = createCacheServiceMock() as unknown as Record<string, unknown>;

        expect(realMethods.length).toBeGreaterThan(0);
        for (const name of realMethods) {
            expect(typeof mock[name]).toBe('function');
        }
    });

    it('includes the method whose absence was being swallowed in CI', () => {
        expect(typeof createCacheServiceMock().invalidatePortalCache).toBe('function');
    });

    it('resolves rather than throwing, so invalidation never fails the write', async () => {
        await expect(createCacheServiceMock().invalidatePortalCache('user-1')).resolves.toBeUndefined();
    });

    it('lets a spec override one method without losing the rest', async () => {
        const mock = createCacheServiceMock({ get: jest.fn().mockResolvedValue('cached') });

        expect(typeof mock.invalidateByPattern).toBe('function');
        await expect(mock.get('k')).resolves.toBe('cached');
    });
});
