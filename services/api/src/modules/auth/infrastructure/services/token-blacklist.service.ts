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
     * On a cache failure this answers `false`, i.e. the token is treated as
     * still valid. That is deliberate: making Redis a hard dependency would turn
     * a cache blip into a platform-wide 401 storm, and Redis is a soft
     * dependency everywhere else in this codebase.
     *
     * Where the failure gets REPORTED is not here. cache-manager catches store
     * errors inside its own get loop, emits a `get` event, and returns
     * `undefined` - it never rethrows, so a try/catch around `cacheService.get`
     * would be dead code that merely looks like protection. The logging lives in
     * CacheService.onModuleInit, which subscribes to that emitter; see the
     * comment there.
     *
     * The try/catch below is therefore NOT the error path - it cannot fire
     * today. It is here so that if CacheService.get ever starts throwing, this
     * check degrades to the fail-open we chose rather than to an unhandled 500,
     * which would be an accidental and much harsher fail-closed.
     *
     * NOTE: none of this detects eviction. An evicted `auth:blacklist:*` key
     * returns `undefined` with no error at all, indistinguishable from "never
     * blacklisted", so no log fires and failing closed would not have helped
     * either. Production Redis was checked on 2026-09-03 and is
     * `maxmemory-policy=noeviction` with `maxmemory 0` at ~3.6MB used, so this
     * cannot currently fire - but it is one config change away from being able
     * to, and the blacklist shares a keyspace with the general cache.
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
                `Token blacklist lookup threw for jti=${jti}; treating the token as NOT revoked: ${msg}`,
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
