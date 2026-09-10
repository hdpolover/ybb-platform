import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { MetricsService } from './metrics.service';
import { MONITORED_QUEUES, QUEUE_POLL_INTERVAL_MS } from '../../constants/rabbitmq-queues';
import { ConsumerStatusService } from '../messaging/consumer-status.service';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

// How long a queue that 404'd stays skipped before being re-probed. A missing
// queue (e.g. retry topology not yet created by a sibling service's first
// deploy) is not going to reappear within the next 15s poll tick, so
// re-checking it every interval is pure noise — but it does need to come
// back into rotation on its own once the queue exists, with no restart.
const MISSING_QUEUE_REPROBE_MS = 5 * 60 * 1000;

@Injectable()
export class QueueMonitoringService implements OnModuleInit, OnModuleDestroy {
    private connection: AmqpConnection | null = null;
    private channel: AmqpChannel | null = null;
    private readonly logger = new Logger(QueueMonitoringService.name);
    private intervalParams: ReturnType<typeof setInterval> | null = null;

    private readonly queues: readonly string[] = MONITORED_QUEUES;

    // Queue name -> timestamp (ms) it was found missing. Checked before each
    // probe so one 404 doesn't blind every queue after it in the list (see
    // checkQueueDepths) and doesn't get re-probed every 15s while it's known
    // absent.
    private readonly missingSince = new Map<string, number>();

    constructor(
        private readonly configService: ConfigService,
        private readonly metricsService: MetricsService,
        // N-2026-09-10-G: feeds per-queue consumerCount into ConsumerStatusService
        // so HealthController can expose runtime consumer liveness alongside the
        // one-shot bootstrap flag it already reports. See ConsumerStatusModule for
        // why this is a small shared module rather than MonitoringModule importing
        // HealthModule (or vice versa).
        private readonly consumerStatus: ConsumerStatusService,
    ) {}

    async onModuleInit() {
        try {
            await this.ensureMonitoringChannel();
            this.logger.log('Queue Monitoring Connected');
            this.intervalParams = setInterval(() => this.checkQueueDepths(), QUEUE_POLL_INTERVAL_MS);
            // Do not let queue polling hold the event loop open on its own. The
            // interval still fires for the life of the process; it just stops a
            // shutdown (or a jest worker) from hanging on it, matching what
            // PrismaService already does for its pool-metrics interval.
            this.intervalParams.unref();
        } catch (error) {
            this.logger.error(`Failed to connect to RabbitMQ for monitoring: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async onModuleDestroy() {
        if (this.intervalParams) clearInterval(this.intervalParams);
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
    }

    private async checkQueueDepths() {
        try {
            await this.ensureMonitoringChannel();
        } catch (error) {
            this.logger.warn(`Unable to refresh queue monitoring channel: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }

        for (const queue of this.queues) {
            const missingAt = this.missingSince.get(queue);
            if (missingAt !== undefined && Date.now() - missingAt < MISSING_QUEUE_REPROBE_MS) {
                // Known missing and not due for a re-probe yet — skip without
                // touching the channel, so this queue doesn't cost the ones after
                // it in the list a reconnect on every single interval.
                continue;
            }

            if (!this.channel) {
                // A prior 404 in this same pass closed the channel (AMQP-correct: a
                // failed passive declare kills the channel — see the catch below).
                // Re-establish it so later queues in the list still get checked
                // instead of the whole pass blinding after the first 404.
                try {
                    await this.ensureMonitoringChannel();
                } catch (error) {
                    this.logger.warn(`Unable to refresh queue monitoring channel: ${error instanceof Error ? error.message : String(error)}`);
                    return;
                }
            }
            if (!this.channel) return;

            try {
                // checkQueue is a passive declare — throws 404 if queue doesn't exist
                const info = await this.channel.checkQueue(queue);
                this.metricsService.jobQueueDepth.set({ queue_name: queue }, info.messageCount);
                this.metricsService.jobQueueConsumers.set({ queue_name: queue }, info.consumerCount);
                // Ignored for any queue that isn't one of this API's own five
                // consumers (notification_queue, .retry/.dlq siblings) — see the
                // guard in recordQueueObservation itself.
                this.consumerStatus.recordQueueObservation(queue, info.consumerCount);
                // The queue exists again (or always did) — clear any stale marker so
                // a future 404 starts its own fresh reprobe window.
                this.missingSince.delete(queue);
            } catch (error) {
                const err = error as { code?: number; message?: string };
                const isNotFound = err.code === 404 || (err.message ?? '').includes('NOT_FOUND');
                if (isNotFound) {
                    // The queue may not exist yet (e.g. retry topology created on
                    // first notification service deploy). Remember it as missing —
                    // re-probed automatically after MISSING_QUEUE_REPROBE_MS, no
                    // restart needed — and move on to the next queue instead of
                    // `break`ing the whole pass.
                    this.logger.debug(`Queue ${queue} not found — will retry in ${MISSING_QUEUE_REPROBE_MS / 1000}s`);
                    this.channel = null;
                    this.missingSince.set(queue, Date.now());
                    continue;
                }
                this.logger.warn(`Failed to check queue depth for ${queue}: ${err.message ?? String(error)}`);
            }
        }
    }

    private async ensureMonitoringChannel() {
        if (!this.connection) {
            // Audit M168: no insecure guest:guest fallback - see
            // rabbitmq-producer.service.ts's onModuleInit for the same fix.
            const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
            this.connection = await amqp.connect(url);
            this.connection.on('error', (error) => {
                this.logger.warn(`Queue monitoring connection error: ${error instanceof Error ? error.message : String(error)}`);
            });
            this.connection.on('close', () => {
                this.channel = null;
                this.connection = null;
                this.logger.warn('Queue monitoring connection closed');
            });
        }

        if (!this.channel) {
            this.channel = await this.connection.createChannel();
            this.channel.on('error', (error) => {
                this.logger.warn(`Queue monitoring channel error: ${error instanceof Error ? error.message : String(error)}`);
            });
            this.channel.on('close', () => {
                this.channel = null;
                this.logger.warn('Queue monitoring channel closed');
            });
        }
    }

    /**
     * Purge non-critical queues (reporting + notifications).
     * Payment and audit queues are intentionally excluded.
     */
    async purgeQueues(): Promise<{ queue: string; purged: number }[]> {
        const purgeable = ['reporting_queue', 'notification_queue'];
        const results: { queue: string; purged: number }[] = [];

        let ch = this.channel;
        if (!ch) {
            // Audit M168: no insecure guest:guest fallback - see
            // rabbitmq-producer.service.ts's onModuleInit for the same fix.
            const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
            const conn = await amqp.connect(url);
            ch = await conn.createChannel();
        }

        for (const queue of purgeable) {
            try {
                const ok = await ch.purgeQueue(queue);
                results.push({ queue, purged: ok.messageCount });
                this.logger.log(`Purged ${ok.messageCount} messages from ${queue}`);
            } catch (error) {
                this.logger.warn(`Could not purge ${queue}: ${error instanceof Error ? error.message : String(error)}`);
                results.push({ queue, purged: 0 });
            }
        }

        return results;
    }
}
