import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { InboundMessageDeserializer } from './common/deserializers/inbound-message.deserializer';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

type AmqpChannel = {
  assertQueue: (
    queue: string,
    options?: {
      durable?: boolean;
      arguments?: Record<string, unknown>;
    },
  ) => Promise<unknown>;
  close(): Promise<void>;
};

type AmqpConnection = {
  createChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
};

type AmqpModule = {
  connect(url: string): Promise<AmqpConnection>;
};

const amqp = require('amqplib') as AmqpModule;

type PrimaryQueueOptions = {
  arguments?: Record<string, string>;
};

type QueueBinding = {
  exchange: string;
  exchangeType: 'topic' | 'direct' | 'fanout' | 'headers';
  routingKey: string;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const rabbitMqUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/';
  const notificationQueue = 'notification_queue';
  const notificationQueueOptions = await resolvePrimaryQueueOptions(
    rabbitMqUrl,
    notificationQueue,
  );

  await ensureRetryTopology(rabbitMqUrl, notificationQueue, {
    primaryQueueOptions: notificationQueueOptions,
    retryDelayMs: parsePositiveInt(
      process.env.NOTIFICATION_QUEUE_RETRY_DELAY_MS,
      15000,
    ),
    bindings: [
      {
        exchange: 'ybb.events',
        exchangeType: 'topic',
        routingKey: '#',
      },
      {
        exchange: 'payment-events',
        exchangeType: 'topic',
        routingKey: 'payment.#',
      },
    ],
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: notificationQueue,
      queueOptions: {
        durable: true,
        ...notificationQueueOptions,
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
  options: {
    retryDelayMs: number;
    primaryQueueOptions: PrimaryQueueOptions;
    bindings?: QueueBinding[];
  },
) {
  const connection = await amqp.connect(rabbitMqUrl);
  let channel: AmqpChannel | undefined;

  try {
    channel = await connection.createChannel();
    const exchangeChannel = channel as AmqpChannel & {
      assertExchange: (
        exchange: string,
        type: 'topic' | 'direct' | 'fanout' | 'headers',
        options?: { durable?: boolean },
      ) => Promise<unknown>;
      bindQueue: (
        queue: string,
        exchange: string,
        routingKey: string,
      ) => Promise<unknown>;
    };

    for (const binding of options.bindings ?? []) {
      await exchangeChannel.assertExchange(
        binding.exchange,
        binding.exchangeType,
        {
          durable: true,
        },
      );
    }
    await channel.assertQueue(queueName, {
      durable: true,
      ...options.primaryQueueOptions,
    });
    await channel.assertQueue(`${queueName}.retry`, {
      durable: true,
      arguments: {
        'x-message-ttl': options.retryDelayMs,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queueName,
      },
    });
    await channel.assertQueue(`${queueName}.dlq`, { durable: true });
    for (const binding of options.bindings ?? []) {
      await exchangeChannel.bindQueue(
        queueName,
        binding.exchange,
        binding.routingKey,
      );
    }
  } finally {
    await closeAmqpChannel(channel);
    await closeAmqpConnection(connection);
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

function buildPrimaryQueueOptions(queueName: string): PrimaryQueueOptions {
  return {
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': `${queueName}.retry`,
    },
  };
}

async function resolvePrimaryQueueOptions(
  rabbitMqUrl: string,
  queueName: string,
): Promise<PrimaryQueueOptions> {
  const retryTopologyOptions = buildPrimaryQueueOptions(queueName);

  // One-time migration: delete the legacy queue so it can be recreated with
  // the retry DLX topology. Set NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY=true,
  // deploy once, then remove the env var. Any messages in the queue are lost.
  if (process.env.NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY === 'true') {
    console.log(
      `[rabbitmq] NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY=true: deleting queue ${queueName} for retry topology migration`,
    );
    await deleteQueue(rabbitMqUrl, queueName);
  }

  try {
    await probePrimaryQueue(rabbitMqUrl, queueName, retryTopologyOptions);
    return retryTopologyOptions;
  } catch (error) {
    if (!isQueuePreconditionFailure(error)) {
      throw error;
    }
  }

  await probePrimaryQueue(rabbitMqUrl, queueName, {});
  console.warn(
    `[rabbitmq] queue ${queueName} is using legacy arguments; keeping current shape to avoid 406 PRECONDITION_FAILED. Run one deploy with NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY=true to migrate it to retry topology.`,
  );
  return {};
}

async function deleteQueue(rabbitMqUrl: string, queueName: string): Promise<void> {
  const connection = await amqp.connect(rabbitMqUrl);
  let channel: AmqpChannel | undefined;
  try {
    channel = await connection.createChannel();
    const ch = channel as AmqpChannel & {
      deleteQueue: (queue: string) => Promise<{ messageCount: number }>;
    };
    const result = await ch.deleteQueue(queueName);
    console.log(`[rabbitmq] deleted queue ${queueName} (had ${result.messageCount} messages)`);
  } catch (error) {
    // Queue may not exist yet — safe to ignore
    console.warn(
      `[rabbitmq] could not delete queue ${queueName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await closeAmqpChannel(channel);
    await closeAmqpConnection(connection);
  }
}

async function probePrimaryQueue(
  rabbitMqUrl: string,
  queueName: string,
  queueOptions: PrimaryQueueOptions,
): Promise<void> {
  const connection = await amqp.connect(rabbitMqUrl);
  let channel: AmqpChannel | undefined;

  try {
    channel = await connection.createChannel();
    await channel.assertQueue(queueName, {
      durable: true,
      ...queueOptions,
    });
  } finally {
    await closeAmqpChannel(channel);
    await closeAmqpConnection(connection);
  }
}

function isQueuePreconditionFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: number; message?: string };
  return (
    maybeError.code === 406 ||
    maybeError.message?.includes('PRECONDITION_FAILED') === true
  );
}

async function closeAmqpChannel(channel: AmqpChannel | undefined) {
  if (!channel) return;

  try {
    await channel.close();
  } catch {
    // RabbitMQ closes the channel itself on 406 PRECONDITION_FAILED.
  }
}

async function closeAmqpConnection(connection: AmqpConnection | undefined) {
  if (!connection) return;

  try {
    await connection.close();
  } catch {
    // The connection may already be closed after a failed channel assertion.
  }
}
