import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { connect, AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';
import { Options } from 'amqplib';

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
      setup: (channel: any) => {
        // Assert exchange to be safe, though init script usually does it
        return channel.assertExchange(this.exchange, 'topic', { durable: true });
      },
    });
  }

  async onModuleDestroy() {
    await this.connection.close();
  }

  async emit(pattern: string, data: any) {
    try {
      this.logger.log(`Publishing event to exchange '${this.exchange}' with routing key '${pattern}'`);
      await this.channelWrapper.publish(
        this.exchange,
        pattern,
        { pattern, data }, 
        { persistent: true } as Options.Publish
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish message: ${error.message}`, error);
      throw error;
    }
  }
}
