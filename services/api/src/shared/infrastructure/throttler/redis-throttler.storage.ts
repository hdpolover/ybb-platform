import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

export interface ThrottlerStorageRecord {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
    private redis: Redis;

    constructor(
        private readonly host: string,
        private readonly port: number,
        private readonly password: string,
    ) {
        this.redis = new Redis({
            host: this.host,
            port: this.port,
            password: this.password || undefined,
            keyPrefix: 'throttler:',
        });
    }

    async onModuleDestroy() {
        await this.redis.quit();
    }

    async increment(
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        throttlerName: string,
    ): Promise<ThrottlerStorageRecord> {
        const fullKey = `${throttlerName}:${key}`;
        const blockKey = `${fullKey}:blocked`;

        // Check if blocked
        const blockedTTL = await this.redis.ttl(blockKey);
        if (blockedTTL > 0) {
            return {
                totalHits: limit + 1,
                timeToExpire: ttl,
                isBlocked: true,
                timeToBlockExpire: blockedTTL * 1000,
            };
        }

        // Increment counter
        const results = await this.redis
            .multi()
            .incr(fullKey)
            .pttl(fullKey)
            .exec();

        const totalHits = (results?.[0]?.[1] as number) || 0;
        let timeToExpire = (results?.[1]?.[1] as number) || -1;

        // Set TTL if not set (first hit)
        if (timeToExpire === -1 || timeToExpire === -2) {
            await this.redis.pexpire(fullKey, ttl);
            timeToExpire = ttl;
        }

        // Check if should block
        if (totalHits > limit && blockDuration > 0) {
            await this.redis.setex(blockKey, Math.floor(blockDuration / 1000), '1');
            return {
                totalHits,
                timeToExpire,
                isBlocked: true,
                timeToBlockExpire: blockDuration,
            };
        }

        return {
            totalHits,
            timeToExpire,
            isBlocked: false,
            timeToBlockExpire: 0,
        };
    }
}
