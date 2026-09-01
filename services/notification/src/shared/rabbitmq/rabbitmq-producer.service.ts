// src/shared/rabbitmq/rabbitmq-producer.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  connect,
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';

// Structural, not `import { Channel } from 'amqplib'`: this service has no
// @types/amqplib and adding one would mean a lockfile change for two field
// names. src/main.ts declares its amqplib shapes the same way.
type PublishOptions = Parameters<ChannelWrapper['publish']>[3];

type AssertExchangeChannel = {
  assertExchange(
    exchange: string,
    type: string,
    options?: { durable?: boolean },
  ): Promise<unknown>;
};

/**
 * Minimal publisher for the one case where this service has something to say
 * back rather than only consume: reporting per-recipient email outcomes to
 * the API, which owns the database (this service has no Prisma or pg
 * dependency and cannot write the audit rows itself).
 *
 * Deliberately a copy of the API's RabbitMQProducerService shape — same
 * `ybb.events` topic exchange, same `{ pattern, data }` envelope the API's
 * RoutingKeyDeserializer expects — rather than a shared package, because
 * these services have no shared build today.
 */
@Injectable()
export class RabbitMQProducerService implements OnModuleInit, OnModuleDestroy {
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;
  private readonly logger = new Logger(RabbitMQProducerService.name);
  private readonly exchange = 'ybb.events';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.configService.get<string>('RABBITMQ_URL') ||
      'amqp://guest:guest@localhost:5672/';

    this.connection = connect([url]);

    this.connection.on('connect', () => {
      this.logger.log('Producer connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Producer disconnected from RabbitMQ', err);
    });

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: AssertExchangeChannel): Promise<void> => {
        await channel.assertExchange(this.exchange, 'topic', { durable: true });
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }

  async emit(pattern: string, data: unknown): Promise<boolean> {
    if (!this.channelWrapper) {
      throw new Error(
        `RabbitMQ producer not initialized — cannot publish '${pattern}'. onModuleInit must complete before emit().`,
      );
    }

    await this.channelWrapper.publish(
      this.exchange,
      pattern,
      { pattern, data },
      // `persistent` lives on amqplib's Options.Publish, which resolves to an
      // empty type here because amqplib ships no types in this service — the
      // cast keeps the flag without pulling in @types/amqplib.
      { persistent: true } as PublishOptions,
    );
    return true;
  }
}
