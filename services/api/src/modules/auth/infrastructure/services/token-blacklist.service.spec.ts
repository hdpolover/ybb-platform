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

        // This is the only per-request revocation check in the auth path, so a
        // cache failure here silently accepts logged-out tokens. We keep
        // fail-open on purpose (Redis is a soft dependency everywhere else and
        // failing closed would 401 every authenticated request), but it must be
        // loud - before this it was invisible on every request.
        it('fails open on a cache error, and says so at error level', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            mockCacheService.get.mockRejectedValue(new Error('redis connection refused'));

            await expect(service.isBlacklisted('jti-1')).resolves.toBe(false);

            expect(logSpy).toHaveBeenCalledTimes(1);
            const message = String(logSpy.mock.calls[0][0]);
            expect(message).toContain('jti-1');
            expect(message).toContain('redis connection refused');

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
