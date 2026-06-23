import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from '../cache/cache.service';

/**
 * Redis Pub/Sub Service
 * 
 * Provides pub/sub functionality for multi-instance cache synchronization.
 * When one instance invalidates cache, all other instances are notified.
 */
@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisPubSubService.name);
    private publisher: Redis;
    private subscriber: Redis;
    private readonly channel = 'cache:invalidate';

    constructor(
        private readonly configService: ConfigService,
        private readonly cacheService: CacheService,
    ) {
        const host = this.configService.get<string>('REDIS_HOST', 'localhost');
        const port = this.configService.get<number>('REDIS_PORT', 6379);
        const password = this.configService.get<string>('REDIS_PASSWORD', '');

        const options = {
            host,
            port,
            password: password || undefined,
            // Defer the TCP connection until first use. Constructing this service must be
            // side-effect free so DI containers (incl. the scoped RMQ consumer apps and
            // module-compile tests) don't open sockets just by wiring providers.
            lazyConnect: true,
        };

        this.publisher = new Redis(options);
        this.subscriber = new Redis(options);
    }

    async onModuleInit() {
        // Subscribe to cache invalidation channel
        await this.subscriber.subscribe(this.channel);
        this.logger.log(`Subscribed to ${this.channel} channel`);

        // Handle incoming messages
        this.subscriber.on('message', async (channel, message) => {
            if (channel === this.channel) {
                await this.handleInvalidation(message);
            }
        });
    }

    async onModuleDestroy() {
        await this.closeClient(this.subscriber, true);
        await this.closeClient(this.publisher, false);
    }

    private async closeClient(client: Redis, isSubscriber: boolean): Promise<void> {
        try {
            if (client.status === 'ready') {
                if (isSubscriber) {
                    await this.subscriber.unsubscribe(this.channel);
                }
                await client.quit();
            } else {
                // Never connected (lazyConnect) or already closing — drop without
                // queueing a command that would force a connection attempt.
                client.disconnect();
            }
        } catch (error) {
            this.logger.warn('Error closing redis client', error as Error);
            client.disconnect();
        }
    }

    /**
     * Publish cache invalidation event
     * All instances subscribed to this channel will invalidate the specified patterns
     */
    async publishInvalidation(patterns: string[]): Promise<void> {
        const message = JSON.stringify({
            patterns,
            timestamp: Date.now(),
            instanceId: process.env.HOSTNAME || 'unknown',
        });

        await this.publisher.publish(this.channel, message);
        this.logger.debug(`Published cache invalidation: ${patterns.join(', ')}`);
    }

    /**
     * Handle incoming invalidation messages
     */
    private async handleInvalidation(message: string): Promise<void> {
        try {
            const data = JSON.parse(message);
            const { patterns } = data;

            if (patterns && Array.isArray(patterns)) {
                await Promise.all(
                    patterns.map((pattern: string) => this.cacheService.invalidateByPattern(pattern)),
                );
                this.logger.debug(`Processed cache invalidation: ${patterns.join(', ')}`);
            }
        } catch (error) {
            this.logger.error('Failed to handle cache invalidation message:', error);
        }
    }

    /**
     * Publish and locally invalidate cache
     * Convenience method that both publishes to other instances and invalidates locally
     */
    async invalidateAndPublish(patterns: string[]): Promise<void> {
        // Invalidate locally
        await Promise.all(
            patterns.map((pattern) => this.cacheService.invalidateByPattern(pattern)),
        );

        // Publish to other instances
        await this.publishInvalidation(patterns);
    }
}
