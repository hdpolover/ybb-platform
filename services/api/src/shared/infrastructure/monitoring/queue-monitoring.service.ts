import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Connection, Channel } from 'amqplib';
import * as amqp from 'amqplib';
import { MetricsService } from './metrics.service';

@Injectable()
export class QueueMonitoringService implements OnModuleInit, OnModuleDestroy {
    private connection: Connection | null = null;
    private channel: Channel | null = null;
    private readonly logger = new Logger(QueueMonitoringService.name);
    private intervalParams: NodeJS.Timeout | null = null;

    private readonly queues = [
        'api-service-payment-events',
        'notification_queue',
    ];

    constructor(
        private readonly configService: ConfigService,
        private readonly metricsService: MetricsService,
    ) {}

    async onModuleInit() {
        try {
            const url = this.configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672/';
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            this.logger.log('Queue Monitoring Connected');
            this.intervalParams = setInterval(() => this.checkQueueDepths(), 15000);
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
        if (!this.channel) return;

        for (const queue of this.queues) {
            try {
                const info = await this.channel.assertQueue(queue, { passive: true });
                this.metricsService.jobQueueDepth.set({ queue_name: queue }, info.messageCount);
                this.metricsService.jobQueueConsumers.set({ queue_name: queue }, info.consumerCount);
            } catch (error) {
                const err = error as { code?: number; message?: string };
                if (err.code !== 404) {
                    this.logger.warn(`Failed to check queue depth for ${queue}: ${err.message ?? String(error)}`);
                }
            }
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
