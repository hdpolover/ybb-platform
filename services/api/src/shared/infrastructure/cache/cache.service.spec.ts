import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

describe('CacheService', () => {
    let service: CacheService;

    const mockCacheManager = {
        del: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
        set: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CacheService,
                { provide: CACHE_MANAGER, useValue: mockCacheManager },
            ],
        }).compile();

        service = module.get<CacheService>(CacheService);
    });

    describe('invalidateInvoiceCache', () => {
        const userId = 'user-123';
        const invoiceId = 'invoice-456';

        it('busts the submission-detail cache so a settled fee unblocks the submit gate', async () => {
            // The submit button reads preview.payment.paid from portal:submission-detail.
            // Regression guard: if this pattern stops being busted, a paid registration fee
            // stays invisible to the gate and the participant cannot submit.
            const patternSpy = jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidateInvoiceCache(invoiceId, userId);

            expect(patternSpy).toHaveBeenCalledWith(`portal:submission-detail:${userId}:*`);
        });

        it('also busts the payments list and dashboard caches', async () => {
            const patternSpy = jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidateInvoiceCache(invoiceId, userId);

            expect(patternSpy).toHaveBeenCalledWith(`portal:payments:${userId}:*`);
            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.PORTAL_DASHBOARD(userId));
            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId));
        });

        it('skips the payment-detail key when no invoiceId is known', async () => {
            jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidateInvoiceCache(undefined, userId);

            expect(mockCacheManager.del).not.toHaveBeenCalledWith(
                CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, expect.any(String)),
            );
        });
    });

    describe('invalidatePortalCache', () => {
        const userId = 'user-123';

        // The bug this guards: portal reads key on (userId, programId) while the
        // write paths deleted only the bare `:latest` key, so a save left the
        // program-scoped entry serving stale data for its whole TTL.
        it('busts every program variant of the keys the portal read handlers use', async () => {
            const patternSpy = jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidatePortalCache(userId);

            const emitted = patternSpy.mock.calls.map(([pattern]) => pattern);
            const matches = (key: string) =>
                emitted.some((pattern) => new RegExp(`^${pattern.replace(/\*/g, '.*')}$`).test(key));

            // A read for a real programId, and the `latest` fallback, must both be covered.
            for (const programId of ['program-abc', undefined]) {
                expect(matches(CACHE_KEYS.PORTAL_SUBMISSIONS(userId, programId))).toBe(true);
                expect(matches(CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId, programId))).toBe(true);
                expect(matches(CACHE_KEYS.PORTAL_PAYMENTS(userId, programId))).toBe(true);
            }
        });

        it('does not bust another user\'s cache', async () => {
            const patternSpy = jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidatePortalCache(userId);

            const emitted = patternSpy.mock.calls.map(([pattern]) => pattern);
            const otherUsersKey = CACHE_KEYS.PORTAL_SUBMISSIONS('user-999', 'program-abc');
            expect(
                emitted.some((pattern) => new RegExp(`^${pattern.replace(/\*/g, '.*')}$`).test(otherUsersKey)),
            ).toBe(false);
        });

        it('also deletes the keys that carry no programId, which patterns cannot reach without Redis', async () => {
            jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidatePortalCache(userId);

            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.PORTAL_DASHBOARD(userId));
            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.PORTAL_DOCUMENTS(userId));
        });

        it('never throws - cache invalidation must not fail the write that triggered it', async () => {
            jest.spyOn(service, 'invalidateByPattern').mockRejectedValue(new Error('redis down'));

            await expect(service.invalidatePortalCache(userId)).resolves.toBeUndefined();
        });
    });

    describe('invalidateBrandLandingCaches', () => {
        const brandId = 'brand-789';

        it('busts the open-registration-editions and brandId-keyed resolveBrand entries alongside the existing landing keys', async () => {
            await service.invalidateBrandLandingCaches(brandId);

            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.LANDING_OPEN_REGISTRATION_PROGRAMS(brandId));
            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.LANDING_BRAND_RESOLVE(brandId));
        });
    });
});
