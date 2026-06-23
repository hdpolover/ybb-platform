import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { connect, AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';
import { Channel, Options } from 'amqplib';

type EmitOptions = {
  messageId?: string;
  correlationId?: string;
  headers?: Record<string, unknown>;
  persistent?: boolean;
};

@Injectable()
export class RabbitMQProducerService implements OnModuleInit, OnModuleDestroy {
  private connection: AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private readonly logger = new Logger(RabbitMQProducerService.name);
  private readonly exchange = 'ybb.events';

  constructor(private readonly configService: ConfigService) { }

  async onModuleInit() {
    const urls = [this.configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672/'];
    
    this.connection = connect(urls);
    
    this.connection.on('connect', () => {
      this.logger.log('Connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Disconnected from RabbitMQ', err);
    });

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: Channel): Promise<void> => {
        await channel.assertExchange(this.exchange, 'topic', { durable: true });
      },
    });
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.close();
    }
  }

  async emit(pattern: string, data: unknown, options?: EmitOptions) {
    try {
      this.logger.log(`Publishing event to exchange '${this.exchange}' with routing key '${pattern}'`);
      await this.channelWrapper.publish(
        this.exchange,
        pattern,
        { pattern, data }, 
        {
          persistent: options?.persistent ?? true,
          messageId: options?.messageId,
          correlationId: options?.correlationId,
          headers: options?.headers,
        } as Options.Publish
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish message: ${error.message}`, error);
      throw error;
    }
  }
}
