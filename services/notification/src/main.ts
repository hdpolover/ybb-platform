import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { InboundMessageDeserializer } from './common/deserializers/inbound-message.deserializer';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import {
  connect as connectAmqp,
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
type QueueAssertChannel = {
  assertQueue: (
    queue: string,
    options?: {
      durable?: boolean;
      arguments?: Record<string, unknown>;
    },
  ) => Promise<unknown>;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const rabbitMqUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/';
  const notificationQueue = 'notification_queue';

  await ensureRetryTopology(rabbitMqUrl, notificationQueue, {
    retryDelayMs: parsePositiveInt(
      process.env.NOTIFICATION_QUEUE_RETRY_DELAY_MS,
      15000,
    ),
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: notificationQueue,
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': `${notificationQueue}.retry`,
        },
      },
      noAck: false,
      prefetchCount: 1,
      deserializer: new InboundMessageDeserializer(),
    },
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Notification Service API')
    .setDescription('API documentation for the Notification Service')
    .setVersion('1.0')
    .addTag('notifications')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 4002);

  console.log(
    `\n🚀 Notification Service is running on: http://localhost:${process.env.PORT || 4002}`,
  );
  console.log(
    `📚 API Documentation: http://localhost:${process.env.PORT || 4002}/api/docs\n`,
  );
}
void bootstrap();

async function ensureRetryTopology(
  rabbitMqUrl: string,
  queueName: string,
  options: { retryDelayMs: number },
) {
  const connection: AmqpConnectionManager = connectAmqp([rabbitMqUrl]);
  const channel: ChannelWrapper = connection.createChannel({
    setup: async (rawChannel: unknown): Promise<void> => {
      const ch = rawChannel as QueueAssertChannel;
      await ch.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': `${queueName}.retry`,
        },
      });
      await ch.assertQueue(`${queueName}.retry`, {
        durable: true,
        arguments: {
          'x-message-ttl': options.retryDelayMs,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': queueName,
        },
      });
      await ch.assertQueue(`${queueName}.dlq`, { durable: true });
    },
  });

  try {
    await channel.waitForConnect();
  } finally {
    await channel.close();
    await connection.close();
  }
}

function parsePositiveInt(
  value: string | undefined,
  defaultValue: number,
): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : defaultValue;
}
