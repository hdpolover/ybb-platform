import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TokenBlacklistService } from './token-blacklist.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

describe('TokenBlacklistService', () => {
    let service: TokenBlacklistService;

    const mockCacheService = {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenBlacklistService,
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<TokenBlacklistService>(TokenBlacklistService);
    });

    describe('isBlacklisted', () => {
        it('reports a revoked token as blacklisted', async () => {
            mockCacheService.get.mockResolvedValue(true);

            await expect(service.isBlacklisted('jti-1')).resolves.toBe(true);
            expect(mockCacheService.get).toHaveBeenCalledWith(CACHE_KEYS.TOKEN_BLACKLIST('jti-1'));
        });

        it('reports an unknown token as not blacklisted', async () => {
            mockCacheService.get.mockResolvedValue(undefined);

            await expect(service.isBlacklisted('jti-1')).resolves.toBe(false);
        });

        // A real Redis failure does NOT reach here as a rejection: cache-manager
        // catches store errors in its own get loop and returns undefined, so
        // this reads as an ordinary miss and the token is accepted. That is the
        // deliberate fail-open, and the REPORTING of it lives in
        // CacheService.onModuleInit's emitter subscription, which is tested in
        // cache.service.spec.ts. Do not add a test here that mocks a rejection
        // and calls it coverage of the outage path - it is not.
        it('treats a swallowed store error as a miss, which is the fail-open we chose', async () => {
            mockCacheService.get.mockResolvedValue(undefined);

            await expect(service.isBlacklisted('jti-1')).resolves.toBe(false);
        });

        // Belt-and-braces only. This cannot fire against cache-manager today; it
        // exists so that if CacheService.get ever starts throwing, this check
        // degrades to the fail-open we chose rather than to an unhandled 500,
        // which would be an accidental and much harsher fail-closed.
        it('degrades to fail-open rather than throwing, if the cache layer ever rejects', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            mockCacheService.get.mockRejectedValue(new Error('redis connection refused'));

            await expect(service.isBlacklisted('jti-1')).resolves.toBe(false);
            expect(logSpy).toHaveBeenCalledTimes(1);

            logSpy.mockRestore();
        });
    });

    describe('blacklistToken', () => {
        // The write side must NOT be swallowed: logout propagates this, so a
        // failed write surfaces to the caller instead of reporting a logout
        // that never happened.
        it('propagates a cache write failure to the caller', async () => {
            mockCacheService.set.mockRejectedValueOnce(new Error('redis connection refused'));

            await expect(service.blacklistToken('jti-1', 1000)).rejects.toThrow('redis connection refused');
        });
    });
});
