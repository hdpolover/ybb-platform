import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

export interface ThrottlerStorageRecord {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}

/**
 * How long a single Redis command may take before we give up and let the
 * request through.
 *
 * This covers the case the connection settings cannot: Redis accepted the
 * socket and is answering, just not promptly — a BGSAVE or AOF rewrite on a
 * shared box, swap pressure, someone running KEYS. Without it a wedged-but-
 * connected server holds every request in the app for as long as it likes,
 * because there is nothing else in the path that times out.
 *
 * 200ms is sized from the real thing, not from a guess. Measured from the
 * production API container to the Redis service over 30 pings on 2026-09-04:
 * p50 0.33ms, p95 0.90ms, worst sample 20.98ms. So this sits about 10x above
 * the worst NORMAL round trip and ~200x above the median, which means it
 * cannot fire on a merely busy server — if it fires, something is genuinely
 * wrong.
 *
 * The cost of getting it wrong is asymmetric and worth stating: too tight and
 * rate limiting silently stops being enforced; too loose and a wedged server
 * holds requests longer. Note the guard evaluates four tiers per request, so
 * a total wedge costs up to 4x this before the request proceeds.
 *
 * KNOWN CEILING, because this is a CLIENT option and therefore also bounds the
 * connection HANDSHAKE (AUTH, CLIENT SETINFO, the ready-check INFO), not just
 * data commands. A handshake command slower than this cannot complete, so the
 * client would never reach `ready` and — with enableOfflineQueue off — every
 * throttler command would reject instantly rather than degrade. Measured
 * headroom against that cliff, all from production or a faithful copy of it:
 * whole handshake from inside the API container p50 4.73ms / p95 8.23ms / max
 * 25.25ms over 30 connects; worst single handshake command 28.8ms even when
 * caught mid-load restoring a 471MB dataset (21x production's); fork pause
 * latest_fork_usec 2071 = 2.07ms over 792 forks. Roughly 7x margin on the
 * worst case observed. Do not lower this without re-measuring those numbers.
 */
const COMMAND_TIMEOUT_MS = 200;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
    private static readonly logger = new Logger(RedisThrottlerStorage.name);

    private redis: Redis;

    /**
     * True while Redis is known to be failing. Latched so a RUN of consecutive
     * failures produces one line and one recovery line, rather than one line
     * per request — at production request rates an unlatched logger turns a
     * Redis outage into a disk-space incident on top of the original problem.
     *
     * Precisely: one line per run, not literally one per outage. An outage
     * that flapped success/failure/success would log per transition. That is
     * not the shape Redis fails in — it is single-threaded and FIFO, so a
     * stall delays every command in the window and they fail as one
     * contiguous block — but the distinction is worth stating so nobody reads
     * a stronger guarantee into it than the code makes.
     */
    private failing = false;

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

            // THESE THREE ARE THE FIX, not the try/catch below.
            //
            // On ioredis defaults (verified against 5.9.2: enableOfflineQueue
            // true, maxRetriesPerRequest 20, connectTimeout 10s) a command
            // issued while the connection is down does not fail — it is QUEUED
            // and retried. So wrapping increment() in a try/catch on its own
            // would not make the throttler fail fast, it would make it fail
            // SLOWLY: every request still waits, four tiers deep, for a
            // connection that is not coming back. A rate limiter that hangs
            // the API is the same outage as one that 500s it, just harder to
            // read in a trace.
            //
            // Refusing to queue is what turns "Redis is down" into an
            // immediate rejection that the catch can convert into a
            // fail-open.
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            commandTimeout: COMMAND_TIMEOUT_MS,
        });

        // ioredis emits 'error' on every failed connection attempt. It routes
        // those through its own silentEmit (Redis.js:528-532), which checks
        // for a listener and, finding none, writes the raw stack straight to
        // console.error — so the process survives, but every retry tick
        // bypasses both the Nest logger and the latch below and prints a full
        // stack. That is the log flood this class is trying to avoid, one
        // layer down. Attaching a listener is what routes those into the
        // latch. Reconnection itself is ioredis's own retryStrategy; this
        // handler does not drive it.
        this.redis.on('error', (error: Error) => {
            this.noteFailure('connection', error);
        });
    }

    async onModuleDestroy() {
        // quit() rejects if the connection is already gone, and an unhandled
        // rejection during shutdown obscures whatever actually caused it.
        try {
            await this.redis.quit();
        } catch {
            this.redis.disconnect();
        }
    }

    /**
     * Record a hit against a throttle bucket.
     *
     * FAILS OPEN. If Redis cannot answer, the request is allowed through
     * rather than refused, and this is deliberate: the guard that calls this
     * is the app's only APP_GUARD, so a throw here does not degrade rate
     * limiting, it 500s EVERY route in the API — login, payments, webhooks —
     * on a dependency that exists only to slow abusive callers down. The
     * guard's own docblock already states the principle ("a rate limiter that
     * 500s a request is a worse outage than the one it prevents"); this is the
     * storage layer finally honouring it. It also matches the availability
     * call the owner already made on the auth token blacklist.
     *
     * What is NOT lost while Redis is down: per-account credential guessing
     * stays bounded, because account lockout counts failures in Postgres
     * (account-lockout.util.ts), not here. So failing open costs the per-IP
     * ceilings and the per-mailbox mail budget for the duration of the outage,
     * not the control that actually protects an account.
     */
    async increment(
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        throttlerName: string,
    ): Promise<ThrottlerStorageRecord> {
        try {
            const record = await this.count(key, ttl, limit, blockDuration, throttlerName);
            this.noteRecovery();
            return record;
        } catch (error) {
            this.noteFailure('command', error);

            // totalHits 0 is what makes this permissive: the guard refuses on
            // `totalHits > limit`, and 0 never exceeds a limit. timeToExpire
            // is echoed back so any Retry-After header the guard writes stays
            // a sane number rather than NaN.
            return { totalHits: 0, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
        }
    }

    /** The original implementation, unchanged in behaviour. */
    private async count(
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

    private noteFailure(source: 'connection' | 'command', error: unknown): void {
        if (this.failing) return;
        this.failing = true;
        RedisThrottlerStorage.logger.error(
            `Redis is unreachable (${source}: ${error instanceof Error ? error.message : String(error)}). ` +
                'Rate limiting is FAILING OPEN until it recovers: per-IP and per-mailbox ceilings are not ' +
                'being enforced. Account lockout is unaffected, it counts in Postgres. This logs once per ' +
                'outage, not once per request.',
        );
    }

    private noteRecovery(): void {
        if (!this.failing) return;
        this.failing = false;
        RedisThrottlerStorage.logger.log('Redis is reachable again; rate limiting is being enforced.');
    }
}
