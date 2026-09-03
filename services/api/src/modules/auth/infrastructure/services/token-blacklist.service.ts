import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

@Injectable()
export class TokenBlacklistService {
    private readonly logger = new Logger(TokenBlacklistService.name);

    constructor(private readonly cacheService: CacheService) { }

    /**
     * Add a token to the blacklist
     * @param jti - JWT ID (unique identifier for the token)
     * @param expiresInMs - Time until token expires (we only need to blacklist until then)
     */
    async blacklistToken(jti: string, expiresInMs: number): Promise<void> {
        const key = CACHE_KEYS.TOKEN_BLACKLIST(jti);
        await this.cacheService.set(key, true, expiresInMs);
    }

    /**
     * Check if a token is blacklisted.
     *
     * This is the ONLY per-request revocation check in the auth path - nothing
     * reads `user_sessions` when validating an access token - so a wrong answer
     * here is the difference between a logout holding and not holding.
     *
     * On a cache error we answer `false` (the token is treated as still valid)
     * rather than locking everyone out: making Redis a hard dependency would
     * turn a cache blip into a platform-wide 401 storm, and Redis is a soft
     * dependency everywhere else in this codebase. That is a deliberate
     * availability-over-strictness choice, but it must not be a SILENT one -
     * cache-manager catches store errors internally, emits a `get` event nobody
     * subscribes to, and hands back `undefined`, so before this log the failure
     * was invisible on every request.
     *
     * Caught here rather than in CacheService.get: that method is shared with
     * read paths (landing, portal) that are meant to degrade quietly, and they
     * should not start logging errors because auth needs to.
     *
     * NOTE: this does not detect eviction. If Redis drops an `auth:blacklist:*`
     * key under memory pressure, `get` returns `undefined` with no error at all
     * - indistinguishable from "never blacklisted". Guarding that needs the
     * blacklist off a shared, evictable keyspace; it is not what this log
     * covers.
     *
     * @param jti - JWT ID to check
     * @returns true if blacklisted, false otherwise
     */
    async isBlacklisted(jti: string): Promise<boolean> {
        const key = CACHE_KEYS.TOKEN_BLACKLIST(jti);
        try {
            const result = await this.cacheService.get<boolean>(key);
            return result === true;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `Token blacklist lookup failed for jti=${jti}; treating the token as NOT revoked. ` +
                `A revoked token is accepted for as long as this persists: ${msg}`,
            );
            return false;
        }
    }

    /**
     * Blacklist all tokens for a user (logout from all devices)
     * @param userId - User ID
     * @param tokenJtis - List of all active token JTIs for the user
     * @param expiresInMs - Max TTL for the blacklist entries
     */
    async blacklistAllUserTokens(
        userId: string,
        tokenJtis: string[],
        expiresInMs: number,
    ): Promise<void> {
        await Promise.all(
            tokenJtis.map((jti) => this.blacklistToken(jti, expiresInMs)),
        );
    }
}
