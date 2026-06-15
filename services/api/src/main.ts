import './tracing';
// BigInt has no JSON serializer by default — convert to number when safe, string otherwise
(BigInt.prototype as any).toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AckDropRmqServer } from './shared/rmq/ack-drop-rmq.server';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { CdnMaskInterceptor } from './shared/interceptors/cdn-mask.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service';
import * as amqp from 'amqplib';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;
type PrimaryQueueOptions = {
  arguments?: Record<string, string>;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const rabbitMqUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/';
  const retryDelayMs = parsePositiveInt(process.env.RABBITMQ_RETRY_DELAY_MS, 15000);
  const [
    auditQueueOptions,
    reportingQueueOptions,
    paymentEventsQueueOptions,
  ] = await Promise.all([
    resolvePrimaryQueueOptions(rabbitMqUrl, 'audit_log_queue'),
    resolvePrimaryQueueOptions(rabbitMqUrl, 'reporting_queue'),
    resolvePrimaryQueueOptions(rabbitMqUrl, 'api-service-payment-events'),
  ]);

  await ensureRetryTopology(rabbitMqUrl, 'audit_log_queue', {
    retryDelayMs,
    primaryQueueOptions: auditQueueOptions,
    binding: {
      exchange: 'ybb.events',
      exchangeType: 'topic',
      routingKey: '#',
    },
  });
  await ensureRetryTopology(rabbitMqUrl, 'reporting_queue', {
    retryDelayMs,
    primaryQueueOptions: reportingQueueOptions,
    binding: {
      exchange: 'ybb.events',
      exchangeType: 'topic',
      routingKey: '#',
    },
  });
  await ensureRetryTopology(rabbitMqUrl, 'api-service-payment-events', {
    retryDelayMs,
    primaryQueueOptions: paymentEventsQueueOptions,
    binding: {
      exchange: 'payment-events',
      exchangeType: 'topic',
      routingKey: 'payment.#',
    },
  });

  // Shared deserializer: maps AMQP routing key → NestJS pattern for messages
  // that don't carry the { pattern, data } NestJS envelope (e.g. Go service,
  // legacy publishers, orphaned queue messages).  Safe to use on all queues —
  // messages that already have a `pattern` field are passed through unchanged.
  const { RoutingKeyDeserializer } = await import('./shared/infrastructure/rabbitmq/routing-key-deserializer');
  const deserializer = new RoutingKeyDeserializer();

  // Connect Microservice for Event Consumption (Audit Logging).
  // Uses AckDropRmqServer so unhandled patterns are ACKed (dropped) instead of
  // nacked, which would otherwise create an infinite retry cycle via the
  // <queue>.retry dead-letter topology.
  app.connectMicroservice<MicroserviceOptions>({
    strategy: new AckDropRmqServer({
      urls: [rabbitMqUrl],
      queue: 'audit_log_queue',
      queueOptions: {
        durable: true,
        ...auditQueueOptions,
      },
      noAck: false,
      prefetchCount: 1,
      deserializer,
    }),
  });

  // Connect Microservice for Reporting Queue.
  // Uses AckDropRmqServer for the same ack-and-drop hardening.
  app.connectMicroservice<MicroserviceOptions>({
    strategy: new AckDropRmqServer({
      urls: [rabbitMqUrl],
      queue: 'reporting_queue',
      queueOptions: {
        durable: true,
        ...reportingQueueOptions,
      },
      noAck: false,
      prefetchCount: 1,
      deserializer,
    }),
  });

  // Connect Microservice for Payment Events (from Go payment service).
  // The Go service publishes to the `payment-events` topic exchange. We declare
  // a dedicated durable queue and bind it via topic routing so payment-events
  // controller's @EventPattern handlers actually receive the events. Without
  // this binding, payment.succeeded / payment.failed events are dropped.
  // Custom deserializer maps the AMQP routing key to the NestJS pattern,
  // because the Go publisher emits raw payloads (no { pattern, data } envelope).
  // Uses AckDropRmqServer for ack-and-drop hardening on unhandled patterns.
  // Note: exchange/exchangeType/routingKey/wildcards are omitted here because
  // ServerRMQ does not consume them — the actual queue-to-exchange binding is
  // established by the ensureRetryTopology() call above via amqplib directly.
  app.connectMicroservice<MicroserviceOptions>({
    strategy: new AckDropRmqServer({
      urls: [rabbitMqUrl],
      queue: 'api-service-payment-events',
      queueOptions: {
        durable: true,
        ...paymentEventsQueueOptions,
      },
      noAck: false,
      prefetchCount: 1,
      deserializer,
    }),
  });

  // Use Winston Logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global exception filter — sanitizes 500 messages in production
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Interceptor for standard response format
  app.useGlobalInterceptors(new TransformInterceptor());
  // Rewrite file URLs to proxy paths so raw storage URLs are never exposed.
  app.useGlobalInterceptors(new CdnMaskInterceptor(app.get(PrismaService)));

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:4001', 'http://localhost:8000']);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global prefix removed in favor of versioning
  // app.setGlobalPrefix('v1');

  // Swagger documentation
  setupSwagger(app);

  // Redirect root URL to documentation
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/', (_req, res) => {
    res.redirect('/docs');
  });

  const port = process.env.PORT || 3000;

  await app.startAllMicroservices();
  await app.listen(port);

  console.log(`\n🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/docs\n`);
}

bootstrap();

async function ensureRetryTopology(
  rabbitMqUrl: string,
  queueName: string,
  options: {
    retryDelayMs: number;
    primaryQueueOptions: PrimaryQueueOptions;
    binding?: {
      exchange: string;
      exchangeType: 'topic' | 'direct' | 'fanout' | 'headers';
      routingKey: string;
    };
  },
) {
  const connection = await amqp.connect(rabbitMqUrl);
  // Suppress unhandled 'error' events emitted by amqplib on channel-level broker errors.
  (connection as unknown as { on: (event: string, fn: (err: unknown) => void) => void }).on('error', () => {});
  const channel = await connection.createChannel();

  try {
    if (options.binding) {
      await channel.assertExchange(options.binding.exchange, options.binding.exchangeType, {
        durable: true,
      });
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

    if (options.binding) {
      await channel.bindQueue(
        queueName,
        options.binding.exchange,
        options.binding.routingKey,
      );
    }
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

function buildPrimaryQueueOptions(
  queueName: string,
): PrimaryQueueOptions {
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
    `[rabbitmq] queue ${queueName} is using legacy arguments; keeping current shape to avoid 406 PRECONDITION_FAILED. Run one deploy with RABBITMQ_QUEUE_CLEANUP_ON_DEPLOY=true to migrate it to retry topology.`,
  );
  return {};
}

async function probePrimaryQueue(
  rabbitMqUrl: string,
  queueName: string,
  queueOptions: PrimaryQueueOptions,
): Promise<void> {
  const connection = await amqp.connect(rabbitMqUrl);
  // Suppress unhandled 'error' events emitted by amqplib on channel-level broker errors.
  (connection as unknown as { on: (event: string, fn: (err: unknown) => void) => void }).on('error', () => {});
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
