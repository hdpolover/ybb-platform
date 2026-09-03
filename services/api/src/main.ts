import './tracing';
// BigInt has no JSON serializer by default — convert to number when safe, string otherwise
(BigInt.prototype as any).toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe, VersioningType, INestMicroservice, Type } from '@nestjs/common';
import { AckDropRmqServer } from './shared/rmq/ack-drop-rmq.server';
import { RoutingKeyDeserializer } from './shared/infrastructure/rabbitmq/routing-key-deserializer';
import { AuditConsumerModule } from './bootstrap/audit-consumer.module';
import { ReportingConsumerModule } from './bootstrap/reporting-consumer.module';
import { PaymentEventsConsumerModule } from './bootstrap/payment-events-consumer.module';
import { LoaEventsConsumerModule } from './bootstrap/loa-events-consumer.module';
import { ReminderEventsConsumerModule } from './bootstrap/reminder-events-consumer.module';
import { AppModule } from './app.module';
import { isSwaggerEnabled, setupSwagger } from './config/swagger.config';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { CdnMaskInterceptor } from './shared/interceptors/cdn-mask.interceptor';
import { CacheService } from './shared/infrastructure/cache/cache.service';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service';
import * as amqp from 'amqplib';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;
type PrimaryQueueOptions = {
  arguments?: Record<string, string>;
};

async function createConsumerApp(
  module: Type<unknown>,
  queue: string,
  queueOptions: PrimaryQueueOptions,
  rabbitMqUrl: string,
  deserializer: RoutingKeyDeserializer,
): Promise<INestMicroservice> {
  return NestFactory.createMicroservice<MicroserviceOptions>(module, {
    strategy: new AckDropRmqServer({
      urls: [rabbitMqUrl],
      queue,
      queueOptions: {
        durable: true,
        ...queueOptions,
      },
      noAck: false,
      prefetchCount: 1,
      deserializer,
    }),
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // DELIBERATELY NOT SET: app.set('trust proxy', ...).
  //
  // The audit backlog suggests it as the fix for `req.ip` being the load
  // balancer. It is the wrong fix here, but NOT because it would be forgeable:
  // scoped to the one Traefik hop, `proxy-addr` stops at the address Traefik
  // itself appended — the caller's real IP — and a prepended value never wins.
  // (An earlier version of this comment claimed log forgery. That is only true
  // for `trust proxy: true` or an over-broad hop count, which is not what
  // anyone would configure. The claim was wrong; the decision was not.)
  //
  // The actual reason: trust proxy cannot see PAST the Cloudflare edge. The
  // chain is client -> Cloudflare -> Traefik -> API, so the address Traefik
  // appends is a CF edge, and Cloudflare rotates edges between connections.
  // Trust proxy would faithfully hand us a different load balancer per request
  // and call it the client — the same defect as `req.ip`, one hop further out.
  // Seeing the real caller requires reading cf-connecting-ip, which trust proxy
  // knows nothing about, and reading it CONDITIONALLY, because the origin is
  // also reachable directly (confirmed) and on that path the header is just
  // something the caller typed.
  //
  // So: `@ClientIp()` / `resolveClientIp()` (src/shared/utils/client-ip.ts).
  // Those read the RIGHTMOST forwarded entry — the one our own edge appended —
  // and only prefer cf-connecting-ip when the hop that reached us is inside a
  // published Cloudflare range. Leaving trust proxy off also keeps `req.ips`
  // empty, so nobody can start reading a value that would need the same
  // conditional treatment to be meaningful.
  const rabbitMqUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/';
  const retryDelayMs = parsePositiveInt(process.env.RABBITMQ_RETRY_DELAY_MS, 15000);
  const [
    auditQueueOptions,
    reportingQueueOptions,
    paymentEventsQueueOptions,
    loaEventsQueueOptions,
    reminderEventsQueueOptions,
  ] = await Promise.all([
    resolvePrimaryQueueOptions(rabbitMqUrl, 'audit_log_queue'),
    resolvePrimaryQueueOptions(rabbitMqUrl, 'reporting_queue'),
    resolvePrimaryQueueOptions(rabbitMqUrl, 'api-service-payment-events'),
    resolvePrimaryQueueOptions(rabbitMqUrl, 'api-service-loa-events'),
    resolvePrimaryQueueOptions(rabbitMqUrl, 'api-service-reminder-events'),
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
  // Per-recipient LOA email outcomes reported back by services/notification,
  // which has no database of its own. Narrow routing key (not 'loa.#') so
  // this queue only ever carries the one event it handles — an unhandled
  // pattern here would be ack-dropped, but a queue that only receives what it
  // handles is easier to reason about when the DLQ is non-empty.
  await ensureRetryTopology(rabbitMqUrl, 'api-service-loa-events', {
    retryDelayMs,
    primaryQueueOptions: loaEventsQueueOptions,
    binding: {
      exchange: 'ybb.events',
      exchangeType: 'topic',
      routingKey: 'loa.batch.send_result',
    },
  });
  // Per-recipient outcomes for admin-scheduled participant reminders, reported
  // back by services/notification. Its own queue rather than a second binding
  // on api-service-loa-events: ensureRetryTopology takes one binding per queue,
  // and a queue that only ever receives what it handles is easier to reason
  // about when the DLQ is non-empty.
  await ensureRetryTopology(rabbitMqUrl, 'api-service-reminder-events', {
    retryDelayMs,
    primaryQueueOptions: reminderEventsQueueOptions,
    binding: {
      exchange: 'ybb.events',
      exchangeType: 'topic',
      routingKey: 'reminder.participant.send_result',
    },
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
  app.useGlobalInterceptors(new CdnMaskInterceptor(app.get(PrismaService), app.get(CacheService)));

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
    // The LOA preview endpoint reports who it rendered as via these three
    // response headers (see program-content.controller.ts previewDocumentTemplate);
    // browsers strip custom headers from cross-origin fetch() responses
    // unless explicitly exposed here.
    exposedHeaders: ['X-Preview-Participant-Name', 'X-Preview-Is-Sample', 'X-Preview-Application-Id'],
  });

  // Global prefix removed in favor of versioning
  // app.setGlobalPrefix('v1');

  // Swagger documentation and the `/` -> `/docs` redirect are development
  // conveniences; production does not serve them. See isSwaggerEnabled for why
  // and for the deliberate break-glass.
  if (isSwaggerEnabled()) {
    setupSwagger(app);

    // Redirect root URL to documentation
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/', (_req, res) => {
      res.redirect('/docs');
    });
  }

  const port = process.env.PORT || 3000;

  // Each consumer runs in its own DI container so only its controller's
  // @EventPattern handlers are registered against its queue. This is what stops
  // the previous app-wide handler fan-out (double/triple processing). The HTTP
  // `app` above intentionally has NO microservice attached.
  const deserializer = new RoutingKeyDeserializer();
  const consumerSpecs: Array<{ queue: string; module: Type<unknown>; queueOptions: PrimaryQueueOptions }> = [
    { queue: 'audit_log_queue', module: AuditConsumerModule, queueOptions: auditQueueOptions },
    { queue: 'reporting_queue', module: ReportingConsumerModule, queueOptions: reportingQueueOptions },
    { queue: 'api-service-payment-events', module: PaymentEventsConsumerModule, queueOptions: paymentEventsQueueOptions },
    { queue: 'api-service-loa-events', module: LoaEventsConsumerModule, queueOptions: loaEventsQueueOptions },
    { queue: 'api-service-reminder-events', module: ReminderEventsConsumerModule, queueOptions: reminderEventsQueueOptions },
  ];
  const consumerApps = await Promise.all(
    consumerSpecs.map((spec) =>
      createConsumerApp(spec.module, spec.queue, spec.queueOptions, rabbitMqUrl, deserializer),
    ),
  );
  await Promise.all(
    consumerApps.map((consumer, i) =>
      consumer.listen().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Consumer for queue "${consumerSpecs[i].queue}" failed to start: ${message}`);
      }),
    ),
  );

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
