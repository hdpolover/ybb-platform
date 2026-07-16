import { Injectable } from '@nestjs/common';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

@Injectable()
export class TokenBlacklistService {
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
     * Check if a token is blacklisted
     * @param jti - JWT ID to check
     * @returns true if blacklisted, false otherwise
     */
    async isBlacklisted(jti: string): Promise<boolean> {
        const key = CACHE_KEYS.TOKEN_BLACKLIST(jti);
        const result = await this.cacheService.get<boolean>(key);
        return result === true;
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
