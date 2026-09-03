import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
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

    describe('onModuleInit (store-failure logging)', () => {
        // cache-manager swallows every store error and returns undefined, so a
        // try/catch at a call site can never fire. The emitter is the only place
        // the error exists. This test drives that real path rather than mocking
        // a rejection the implementation cannot produce.
        const buildWithEmitter = async () => {
            const listeners: Record<string, Array<(p: unknown) => void>> = {};
            const emitterCacheManager = {
                ...mockCacheManager,
                on: jest.fn((event: string, listener: (p: unknown) => void) => {
                    (listeners[event] ??= []).push(listener);
                }),
            };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CacheService,
                    { provide: CACHE_MANAGER, useValue: emitterCacheManager },
                ],
            }).compile();
            const svc = module.get<CacheService>(CacheService);
            svc.onModuleInit();
            const emit = (event: string, payload: unknown) =>
                (listeners[event] ?? []).forEach((l) => l(payload));
            return { svc, emit, emitterCacheManager };
        };

        it('logs a store error that cache-manager would otherwise swallow', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            const { emit } = await buildWithEmitter();

            emit('get', {
                key: CACHE_KEYS.TOKEN_BLACKLIST('jti-abc'),
                error: new Error('redis connection refused'),
            });

            expect(logSpy).toHaveBeenCalledTimes(1);
            expect(String(logSpy.mock.calls[0][0])).toContain('redis connection refused');
            logSpy.mockRestore();
        });

        it('logs the key prefix only, never the jti or user id', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            const { emit } = await buildWithEmitter();

            emit('get', {
                key: CACHE_KEYS.TOKEN_BLACKLIST('jti-abc'),
                error: new Error('boom'),
            });

            const message = String(logSpy.mock.calls[0][0]);
            expect(message).toContain('auth:blacklist');
            expect(message).not.toContain('jti-abc');
            logSpy.mockRestore();
        });

        // The first version of this sliced the first two colon-segments, which is
        // right for auth:blacklist:<jti> but emits the id outright for the
        // builders whose SECOND segment IS the identifier. One case per key
        // shape, because covering only the three-segment one is what hid it.
        it.each([
            ['auth:blacklist:<jti>',            CACHE_KEYS.TOKEN_BLACKLIST('7f3a9c21-0b4e-4d1a-9f22-1c8e5a6b7d90'), 'auth:blacklist'],
            ['user:<id>',                       CACHE_KEYS.USER('7f3a9c21-0b4e-4d1a-9f22-1c8e5a6b7d90'),            'user'],
            ['application:<id>',                CACHE_KEYS.APPLICATION('7f3a9c21-0b4e-4d1a-9f22-1c8e5a6b7d90'),     'application'],
            ['category:<id>',                   CACHE_KEYS.CATEGORY('7f3a9c21-0b4e-4d1a-9f22-1c8e5a6b7d90'),        'category'],
            ['user:list:<brandId>:...',         CACHE_KEYS.USER_LIST('7f3a9c21-0b4e-4d1a-9f22-1c8e5a6b7d90', 0, 20), 'user:list'],
            ['portal:submissions:<u>:<p>',      CACHE_KEYS.PORTAL_SUBMISSIONS('user-1', 'program-1'),               'portal:submissions'],
            ['metadata:timezones:<search>',     CACHE_KEYS.METADATA_TIMEZONES('jakarta'),                           'metadata:timezones'],
        ])('logs only the static label for %s', async (_shape, key, expected) => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            const { emit } = await buildWithEmitter();

            emit('get', { key, error: new Error('boom') });

            const message = String(logSpy.mock.calls[0][0]);
            expect(message).toContain(`"${expected}"`);
            // Whatever followed the label must not survive into the log.
            const identifier = key.slice(expected.length + 1);
            if (identifier) expect(message).not.toContain(identifier);
            logSpy.mockRestore();
        });

        it('refuses to log a key whose very first segment is an identifier', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            const { emit } = await buildWithEmitter();

            emit('get', { key: '7f3a9c21-0b4e-4d1a-9f22-1c8e5a6b7d90:whatever', error: new Error('boom') });

            const message = String(logSpy.mock.calls[0][0]);
            expect(message).toContain('(unrecognised)');
            expect(message).not.toContain('7f3a9c21');
            logSpy.mockRestore();
        });

        it('cannot be used to forge a log line from a user-supplied key fragment', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            const { emit } = await buildWithEmitter();

            emit('get', {
                key: CACHE_KEYS.METADATA_TIMEZONES('x\nERROR [Auth] forged line'),
                error: new Error('boom'),
            });

            const message = String(logSpy.mock.calls[0][0]);
            expect(message).toContain('metadata:timezones');
            expect(message).not.toContain('forged');
            logSpy.mockRestore();
        });

        it('stays quiet on a normal hit or miss', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            const { emit } = await buildWithEmitter();

            emit('get', { key: 'portal:submissions:user-1:latest', value: undefined });
            emit('get', { key: 'portal:submissions:user-1:latest', value: { ok: true } });

            expect(logSpy).not.toHaveBeenCalled();
            logSpy.mockRestore();
        });

        it('degrades quietly when the cache manager exposes no emitter', async () => {
            const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

            // `service` comes from the outer beforeEach, whose mock has no `on`.
            expect(() => service.onModuleInit()).not.toThrow();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
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
