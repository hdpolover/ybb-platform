import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

type EnqueuePaymentOutboxParams = {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
    dedupeKey?: string;
    correlationId?: string;
};

type ClaimedOutboxRow = {
    id: string;
    eventType: string;
    payload: unknown;
    dedupeKey: string;
    correlationId: string | null;
    attempts: number;
};

@Injectable()
export class PaymentOutboxService {
    private readonly logger = new Logger(PaymentOutboxService.name);
    private readonly enabled = parseBool(process.env.ENABLE_PAYMENT_OUTBOX, false);
    private readonly batchSize = parsePositiveInt(process.env.PAYMENT_OUTBOX_BATCH_SIZE, 50);
    private readonly maxAttempts = parsePositiveInt(process.env.PAYMENT_OUTBOX_MAX_ATTEMPTS, 12);
    private readonly retryBaseDelaySeconds = parsePositiveInt(
        process.env.PAYMENT_OUTBOX_RETRY_BASE_DELAY_SECONDS,
        15,
    );
    private readonly maxRetryDelaySeconds = parsePositiveInt(
        process.env.PAYMENT_OUTBOX_MAX_RETRY_DELAY_SECONDS,
        900,
    );

    constructor(
        private readonly prisma: PrismaService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) {}

    isEnabled(): boolean {
        return this.enabled;
    }

    async enqueueInTransaction(
        tx: Prisma.TransactionClient,
        params: EnqueuePaymentOutboxParams,
    ): Promise<{ queued: boolean; dedupeKey: string }> {
        const payloadJson = stableStringify(params.payload ?? {});
        const dedupeKey =
            normalizeString(params.dedupeKey) ??
            buildDedupeKey(params.eventType, params.aggregateId, payloadJson);

        if (!this.enabled) {
            return { queued: false, dedupeKey };
        }

        const correlationId =
            normalizeString(params.correlationId) ??
            dedupeKey;

        const inserted = await tx.$executeRaw`
            INSERT INTO payment_outbox_events (
                event_type,
                aggregate_type,
                aggregate_id,
                payload,
                dedupe_key,
                correlation_id,
                status,
                attempts,
                next_attempt_at,
                created_at,
                updated_at
            )
            VALUES (
                ${params.eventType},
                ${params.aggregateType},
                ${params.aggregateId},
                ${payloadJson}::jsonb,
                ${dedupeKey},
                ${correlationId},
                'pending',
                0,
                NOW(),
                NOW(),
                NOW()
            )
            ON CONFLICT (dedupe_key) DO NOTHING
        `;

        return { queued: Number(inserted) > 0, dedupeKey };
    }

    @Cron('*/10 * * * * *')
    async publishPending(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const claimed = await this.claimBatch();
        if (claimed.length === 0) {
            return;
        }

        for (const row of claimed) {
            await this.publishOne(row);
        }
    }

    private async claimBatch(): Promise<ClaimedOutboxRow[]> {
        return this.prisma.$queryRaw<ClaimedOutboxRow[]>`
            WITH next_events AS (
                SELECT id
                FROM payment_outbox_events
                WHERE status IN ('pending', 'failed')
                  AND next_attempt_at <= NOW()
                  AND attempts < ${this.maxAttempts}
                ORDER BY created_at ASC
                LIMIT ${this.batchSize}
                FOR UPDATE SKIP LOCKED
            )
            UPDATE payment_outbox_events o
            SET
                status = 'processing',
                attempts = o.attempts + 1,
                updated_at = NOW()
            FROM next_events n
            WHERE o.id = n.id
            RETURNING
                o.id::text AS id,
                o.event_type AS "eventType",
                o.payload AS payload,
                o.dedupe_key AS "dedupeKey",
                o.correlation_id AS "correlationId",
                o.attempts AS attempts
        `;
    }

    private async publishOne(row: ClaimedOutboxRow): Promise<void> {
        try {
            await this.rabbitmqProducer.emit(row.eventType, row.payload, {
                messageId: row.dedupeKey,
                correlationId: row.correlationId ?? row.dedupeKey,
                headers: {
                    'x-outbox-id': row.id,
                    'x-outbox-dedupe-key': row.dedupeKey,
                    'x-outbox-attempt': row.attempts,
                },
                persistent: true,
            });

            await this.prisma.$executeRaw`
                UPDATE payment_outbox_events
                SET
                    status = 'published',
                    published_at = NOW(),
                    last_error = NULL,
                    updated_at = NOW()
                WHERE id = ${row.id}::uuid
            `;
        } catch (error) {
            const message = toErrorMessage(error);
            const isLastAttempt = row.attempts >= this.maxAttempts;
            const retryDelaySeconds = isLastAttempt
                ? 0
                : this.computeRetryDelaySeconds(row.attempts);

            await this.prisma.$executeRaw`
                UPDATE payment_outbox_events
                SET
                    status = ${isLastAttempt ? 'dead' : 'failed'},
                    last_error = ${message},
                    next_attempt_at = NOW() + (${retryDelaySeconds} * INTERVAL '1 second'),
                    updated_at = NOW()
                WHERE id = ${row.id}::uuid
            `;

            this.logger.error(
                `[payment-outbox] publish failed event=${row.eventType} id=${row.id} attempts=${row.attempts} status=${isLastAttempt ? 'dead' : 'failed'} error=${message}`,
            );
        }
    }

    private computeRetryDelaySeconds(attempt: number): number {
        const exponent = Math.max(0, attempt - 1);
        const delay = this.retryBaseDelaySeconds * 2 ** exponent;
        return Math.min(delay, this.maxRetryDelaySeconds);
    }
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
}

function normalizeString(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries
        .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
        .join(',')}}`;
}

function buildDedupeKey(eventType: string, aggregateId: string, payloadJson: string): string {
    const digest = createHash('sha256')
        .update(`${eventType}:${aggregateId}:${payloadJson}`)
        .digest('hex')
        .slice(0, 40);
    return `payment-outbox:${eventType}:${aggregateId}:${digest}`;
}

function toErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}
