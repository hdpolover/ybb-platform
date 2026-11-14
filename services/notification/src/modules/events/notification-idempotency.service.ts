import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash, randomUUID } from 'crypto';

type DedupeMeta = {
  messageId?: string;
  correlationId?: string;
};

/** Outcome of claiming one recipient of a fan-out batch; see claimRecipient(). */
export type RecipientClaim =
  | { state: 'claimed' }
  | { state: 'sent'; providerMessageId: string | null }
  | { state: 'in_progress' };

const RECIPIENT_PROCESSING_PREFIX = 'processing:';
const RECIPIENT_SENT_PREFIX = 'sent:';

type DedupeResult = {
  shouldProcess: boolean;
  dedupeKey: string;
  reason: 'new' | 'duplicate' | 'disabled' | 'fallback';
};

interface RedisSetClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<'OK' | null>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
    condition: 'NX',
  ): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  disconnect(): void;
}

const PAYMENT_EVENTS = new Set([
  'payment.succeeded',
  'payment.created',
  'payment.failed',
  'payment.refunded',
]);

/** Returns the last `length` characters of a dedupe key for safe log output. */
export function abbreviateDedupeKey(key: string, length = 12): string {
  return key.length <= length ? key : `...${key.slice(-length)}`;
}

@Injectable()
export class NotificationIdempotencyService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationIdempotencyService.name);
  private readonly enabled: boolean;
  private readonly defaultTtlSeconds: number;
  private readonly paymentTtlSeconds: number;
  private redisClient?: RedisSetClient;
  /** Tells "this process is sending" from "a dead process was sending" in recipient claims. */
  private readonly instanceId = randomUUID();

  /** Timestamp (ms) until which the circuit is open (error logs are suppressed). */
  private circuitOpenUntil = 0;
  private static readonly CIRCUIT_COOLDOWN_MS = 30_000;
  private static readonly CIRCUIT_COOLDOWN_SECONDS =
    NotificationIdempotencyService.CIRCUIT_COOLDOWN_MS / 1000;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.parseBool(
      this.configService.get<string>('NOTIFICATION_IDEMPOTENCY_ENABLED'),
      true,
    );
    this.defaultTtlSeconds = this.parseInt(
      this.configService.get<string>(
        'NOTIFICATION_IDEMPOTENCY_DEFAULT_TTL_SECONDS',
      ),
      24 * 60 * 60,
    );
    this.paymentTtlSeconds = this.parseInt(
      this.configService.get<string>(
        'NOTIFICATION_IDEMPOTENCY_PAYMENT_TTL_SECONDS',
      ),
      7 * 24 * 60 * 60,
    );

    if (!this.enabled) {
      this.logger.warn(
        'Notification idempotency disabled via NOTIFICATION_IDEMPOTENCY_ENABLED',
      );
      return;
    }

    const redis = this.createRedisClient();
    if (!redis) {
      this.logger.warn(
        'Notification idempotency fallback mode: Redis is not configured. Duplicate events may be reprocessed.',
      );
      return;
    }
    this.redisClient = redis;
  }

  async shouldProcess(
    eventType: string,
    payload: unknown,
    meta: DedupeMeta,
  ): Promise<DedupeResult> {
    const dedupeKey = this.buildDedupeKey(eventType, payload, meta);

    if (!this.enabled) {
      return { shouldProcess: true, dedupeKey, reason: 'disabled' };
    }

    if (!this.redisClient) {
      return { shouldProcess: true, dedupeKey, reason: 'fallback' };
    }

    try {
      const ttl = this.getTtlForEvent(eventType);
      const setResult = await this.redisClient.set(
        dedupeKey,
        '1',
        'EX',
        ttl,
        'NX',
      );
      if (setResult === 'OK') {
        return { shouldProcess: true, dedupeKey, reason: 'new' };
      }
      return { shouldProcess: false, dedupeKey, reason: 'duplicate' };
    } catch (error) {
      const now = Date.now();
      if (now >= this.circuitOpenUntil) {
        this.logger.error(
          `Idempotency check failed for ${eventType}. Processing event in fallback mode. ` +
            `(Further errors suppressed for ${NotificationIdempotencyService.CIRCUIT_COOLDOWN_SECONDS}s)`,
          error instanceof Error ? error.stack : String(error),
        );
        this.circuitOpenUntil =
          now + NotificationIdempotencyService.CIRCUIT_COOLDOWN_MS;
      }
      return { shouldProcess: true, dedupeKey, reason: 'fallback' };
    }
  }

  /**
   * Frees a key claimed by shouldProcess() when processing failed. Without
   * this the DLX retry of the same message is deduped and the email is lost.
   */
  async release(dedupeKey: string): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.del(dedupeKey);
      // The retry is a new delivery attempt and gets its own redelivery grant.
      await this.redisClient.del(`${dedupeKey}:redelivered`);
    } catch (error) {
      this.logger.error(
        `Failed to release idempotency key ${abbreviateDedupeKey(dedupeKey)}; the retry will be deduped`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Grants ONE reprocessing of a message the broker redelivered after its
   * first consumer died holding the key. Returns false on the second ask (and
   * on a Redis error), so a message that kills the process every time it is
   * handled is skipped on its next delivery, not reprocessed forever: a
   * redelivery is never nacked, so the retry/DLQ cap would not stop it.
   */
  async claimRedelivery(dedupeKey: string): Promise<boolean> {
    if (!this.redisClient) return false;
    try {
      const setResult = await this.redisClient.set(
        `${dedupeKey}:redelivered`,
        '1',
        'EX',
        this.defaultTtlSeconds,
        'NX',
      );
      return setResult === 'OK';
    } catch (error) {
      this.logger.error(
        `Failed to claim redelivery for ${abbreviateDedupeKey(dedupeKey)}; treating it as a duplicate`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Claims one recipient of a fan-out batch so a reprocessed message resumes
   * instead of re-mailing. A claim left by another instance means that process
   * died mid-send, so it is taken over (the email may then go out twice, the
   * same trade as claimRedelivery). Every failure mode falls back to 'claimed':
   * a duplicate beats a silent drop.
   */
  async claimRecipient(key: string): Promise<RecipientClaim> {
    if (!this.enabled || !this.redisClient) return { state: 'claimed' };
    const mine = `${RECIPIENT_PROCESSING_PREFIX}${this.instanceId}`;
    try {
      const setResult = await this.redisClient.set(
        key,
        mine,
        'EX',
        this.defaultTtlSeconds,
        'NX',
      );
      if (setResult === 'OK') return { state: 'claimed' };

      const existing = await this.redisClient.get(key);
      if (existing === null) {
        // Expired or released between the two calls: nothing holds it now.
        await this.redisClient.set(key, mine, 'EX', this.defaultTtlSeconds);
        return { state: 'claimed' };
      }
      if (existing.startsWith(RECIPIENT_SENT_PREFIX)) {
        return {
          state: 'sent',
          providerMessageId:
            existing.slice(RECIPIENT_SENT_PREFIX.length) || null,
        };
      }
      if (existing === mine) return { state: 'in_progress' };

      await this.redisClient.set(key, mine, 'EX', this.defaultTtlSeconds);
      return { state: 'claimed' };
    } catch (error) {
      this.logger.error(
        `Failed to claim recipient ${abbreviateDedupeKey(key)}; sending in fallback mode`,
        error instanceof Error ? error.stack : String(error),
      );
      return { state: 'claimed' };
    }
  }

  /** Records a delivered email. Never throws: the email is out, so a Redis failure here is not a send failure. */
  async markRecipientSent(
    key: string,
    providerMessageId: string | null,
  ): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.set(
        key,
        `${RECIPIENT_SENT_PREFIX}${providerMessageId ?? ''}`,
        'EX',
        this.defaultTtlSeconds,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record sent recipient ${abbreviateDedupeKey(key)}; a reprocessed batch may mail them again`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  onModuleDestroy() {
    this.redisClient?.disconnect();
  }

  // Test hook to avoid private property mutation in specs.
  setRedisClientForTesting(client: RedisSetClient | undefined) {
    this.redisClient = client;
  }

  private createRedisClient(): RedisSetClient | undefined {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      return new Redis(redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
      });
    }

    const host = this.configService.get<string>('REDIS_HOST');
    const portRaw = this.configService.get<string>('REDIS_PORT');
    if (!host) return undefined;

    const port = Number(portRaw || 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = Number(this.configService.get<string>('REDIS_DB') || 0);

    return new Redis({
      host,
      port: Number.isFinite(port) ? port : 6379,
      password: password || undefined,
      db: Number.isFinite(db) ? db : 0,
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
  }

  private buildDedupeKey(
    eventType: string,
    payload: unknown,
    meta: DedupeMeta,
  ): string {
    const payloadRecord =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    const metadata =
      payloadRecord.metadata && typeof payloadRecord.metadata === 'object'
        ? (payloadRecord.metadata as Record<string, unknown>)
        : {};

    const sourceId =
      meta.messageId ||
      meta.correlationId ||
      this.asString(payloadRecord.payment_id) ||
      this.asString(payloadRecord.order_id) ||
      this.asString(payloadRecord.id) ||
      this.asString(payloadRecord.external_intent_id) ||
      this.asString(metadata.invoice_id) ||
      this.asString(metadata.application_id) ||
      this.hashPayload(payloadRecord);

    return `notification:idempotency:${eventType}:${sourceId}`;
  }

  private getTtlForEvent(eventType: string): number {
    return PAYMENT_EVENTS.has(eventType)
      ? this.paymentTtlSeconds
      : this.defaultTtlSeconds;
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const serialized = this.stableStringify(payload);
    return createHash('sha256').update(serialized).digest('hex').slice(0, 24);
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`)
      .join(',')}}`;
  }

  private asString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private parseBool(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private parseInt(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : defaultValue;
  }
}
