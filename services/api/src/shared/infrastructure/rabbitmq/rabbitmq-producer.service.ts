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
    if (!this.channelWrapper) {
      throw new Error(
        `RabbitMQ producer not initialized — cannot publish '${pattern}'. onModuleInit must complete before emit().`,
      );
    }
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

  /**
   * Same as emit(), but NEVER rejects. Use this for every call site that does
   * not already wrap emit() in its own try/catch — a broker hiccup must not
   * become an unhandled rejection, because this process hosts both the HTTP
   * app and every RMQ consumer (see main.ts bootstrap()); one unhandled
   * rejection here can crash all of it, not just the request that triggered
   * the publish.
   *
   * Returns true on success, false on failure. Callers that need to know
   * whether the message actually went out (e.g. a user-visible email) should
   * check the return value and log/react accordingly instead of assuming
   * fire-and-forget is safe to ignore.
   */
  async emitSafe(pattern: string, data: unknown, options?: EmitOptions): Promise<boolean> {
    try {
      await this.emit(pattern, data, options);
      return true;
    } catch (error) {
      // emit() already logs the error before rethrowing; log again here with
      // the identifying context (pattern + messageId, when the caller passed
      // one) so a dropped event is debuggable from this log line alone,
      // without needing to correlate against emit()'s internal log.
      this.logger.error(
        `emitSafe: swallowed publish failure for pattern '${pattern}'` +
          (options?.messageId ? ` (messageId: ${options.messageId})` : '') +
          `: ${error.message}`,
        error,
      );
      return false;
    }
  }
}
