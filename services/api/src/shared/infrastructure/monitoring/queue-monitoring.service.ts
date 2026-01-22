import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { MetricsService } from './metrics.service';

@Injectable()
export class QueueMonitoringService implements OnModuleInit, OnModuleDestroy {
    private connection: amqp.Connection;
    private channel: amqp.Channel;
    private readonly logger = new Logger(QueueMonitoringService.name);
    private intervalParams: NodeJS.Timeout;

    // Queues to monitor
    private readonly queues = [
        'api-service-payment-events',
        'notification_queue', 
        // Add other queues here as they are discovered/created
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

            // Start polling every 15 seconds
            this.intervalParams = setInterval(() => this.checkQueueDepths(), 15000);
        } catch (error) {
            this.logger.error(`Failed to connect to RabbitMQ for monitoring: ${error.message}`);
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
                // assertQueue with passive: true checks existence and returns stats without modifying
                const info = await this.channel.assertQueue(queue, { passive: true });
                
                this.metricsService.jobQueueDepth.set({ queue_name: queue }, info.messageCount);
                this.metricsService.jobQueueConsumers.set({ queue_name: queue }, info.consumerCount);
                
            } catch (error) {
                // If queue doesn't exist (404), allow it, maybe it hasn't been created yet
                if (error.code !== 404) { 
                    this.logger.warn(`Failed to check queue depth for ${queue}: ${error.message}`);
                }
            }
        }
    }
}
