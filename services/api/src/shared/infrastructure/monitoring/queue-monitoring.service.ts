import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { MetricsService } from './metrics.service';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

@Injectable()
export class QueueMonitoringService implements OnModuleInit, OnModuleDestroy {
    private connection: AmqpConnection | null = null;
    private channel: AmqpChannel | null = null;
    private readonly logger = new Logger(QueueMonitoringService.name);
    private intervalParams: ReturnType<typeof setInterval> | null = null;

    private queues = [
        'api-service-payment-events',
        'api-service-payment-events.retry',
        'api-service-payment-events.dlq',
        'notification_queue',
        'notification_queue.retry',
        'notification_queue.dlq',
    ];

    constructor(
        private readonly configService: ConfigService,
        private readonly metricsService: MetricsService,
    ) {}

    async onModuleInit() {
        try {
            await this.ensureMonitoringChannel();
            this.logger.log('Queue Monitoring Connected');
            this.intervalParams = setInterval(() => this.checkQueueDepths(), 15000);
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

        if (!this.channel) return;

        for (const queue of this.queues) {
            try {
                // checkQueue is a passive declare — throws 404 if queue doesn't exist
                const info = await this.channel.checkQueue(queue);
                this.metricsService.jobQueueDepth.set({ queue_name: queue }, info.messageCount);
                this.metricsService.jobQueueConsumers.set({ queue_name: queue }, info.consumerCount);
            } catch (error) {
                const err = error as { code?: number; message?: string };
                const isNotFound = err.code === 404 || (err.message ?? '').includes('NOT_FOUND');
                if (isNotFound) {
                    // checkQueue on a missing queue closes the channel; the queue may not
                    // exist yet (e.g. retry topology created on first notification service deploy).
                    // Reconnect lazily on next interval — do NOT permanently drop so monitoring
                    // resumes automatically once the queue is created.
                    this.logger.debug(`Queue ${queue} not found — will retry on next interval`);
                    this.channel = null;
                    break;
                }
                this.logger.warn(`Failed to check queue depth for ${queue}: ${err.message ?? String(error)}`);
            }
        }
    }

    private async ensureMonitoringChannel() {
        if (!this.connection) {
            const url = this.configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672/';
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
            const url = this.configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672/';
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
