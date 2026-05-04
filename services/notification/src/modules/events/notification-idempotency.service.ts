import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';

type DedupeMeta = {
  messageId?: string;
  correlationId?: string;
};

type DedupeResult = {
  shouldProcess: boolean;
  dedupeKey: string;
  reason: 'new' | 'duplicate' | 'disabled' | 'fallback';
};

interface RedisSetClient {
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
    condition: 'NX',
  ): Promise<'OK' | null>;
  disconnect(): void;
}

const PAYMENT_EVENTS = new Set([
  'payment.succeeded',
  'payment.created',
  'payment.failed',
  'payment.refunded',
]);

@Injectable()
export class NotificationIdempotencyService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationIdempotencyService.name);
  private readonly enabled: boolean;
  private readonly defaultTtlSeconds: number;
  private readonly paymentTtlSeconds: number;
  private redisClient?: RedisSetClient;

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
      this.logger.error(
        `Idempotency check failed for ${eventType}. Processing event in fallback mode.`,
        error instanceof Error ? error.stack : String(error),
      );
      return { shouldProcess: true, dedupeKey, reason: 'fallback' };
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
      this.asString(payloadRecord.email) ||
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
