import './tracing';
// BigInt has no JSON serializer by default — convert to number when safe, string otherwise
(BigInt.prototype as any).toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

// Process-level safety net, installed before anything else runs. This
// process hosts the HTTP app AND every RMQ consumer (see the consumer app
// wiring in connectRabbitMqConsumers below) — an unhandled rejection anywhere
// takes all of it down together, not just the request or message that caused it.
//
// This is NOT a silent catch-all: it logs at error level with the full
// reason/stack and does nothing else. It does not prevent the underlying bug
// from being visible — it prevents one dropped promise from being a process
// outage. Fire-and-forget call sites (e.g. RabbitMQProducerService.emitSafe)
// should still handle their own errors; this is the backstop for whatever
// they, or a future call site, miss.
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error(
    '[FATAL-CANDIDATE] Unhandled promise rejection — this indicates a missing .catch()/try-catch somewhere. ' +
      'The process is intentionally NOT exiting, but this must be fixed:',
    reason instanceof Error ? reason.stack ?? reason.message : reason,
    { promise },
  );
});
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe, VersioningType, INestMicroservice, Type } from '@nestjs/common';
import { createCompressionMiddleware } from './shared/infrastructure/http/compression.config';
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
import { ConsumerStatusService } from './shared/infrastructure/messaging/consumer-status.service';
import {
  AUDIT_LOG_QUEUE,
  REPORTING_QUEUE,
  PAYMENT_EVENTS_QUEUE,
  LOA_EVENTS_QUEUE,
  REMINDER_EVENTS_QUEUE,
} from './shared/constants/rabbitmq-queues';
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

export async function bootstrap() {
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
  // Audit M168: no insecure guest:guest fallback. AppModule's ConfigModule
  // (imported above via NestFactory.create) already runs validateEnv() and
  // crashes the process before this line is reached if RABBITMQ_URL is
  // missing — the explicit throw here is just defense in depth against this
  // function ever being reached some other way.
  const rabbitMqUrl = process.env.RABBITMQ_URL;
  if (!rabbitMqUrl) {
    throw new Error('RABBITMQ_URL is required and must be set - no insecure default is allowed.');
  }
  const retryDelayMs = parsePositiveInt(process.env.RABBITMQ_RETRY_DELAY_MS, 15000);

  // HTTP response compression (audit M170/M176). Cloudflare already compresses
  // the client-facing hop (client -> Cloudflare -> Traefik -> API, documented
  // above at the trust-proxy note), so this does not change what a browser
  // receives. It does compress the one hop Cloudflare can't reach: server-side
  // fetches that land on the API directly (Traefik -> API, and any same-DC
  // caller), and it is cheap insurance if that chain is ever reconfigured. See
  // compression.config.ts for the threshold and the streaming-download filter.
  app.use(createCompressionMiddleware());

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

  // M171: the HTTP server must accept connections even when RabbitMQ is
  // completely unreachable (or its topology has drifted, e.g. a changed
  // RABBITMQ_RETRY_DELAY_MS against an already-declared `.retry` queue).
  // Everything above this line is HTTP-only setup with no broker I/O, so
  // `app.listen` goes up here, ABOVE all RabbitMQ work — topology probes,
  // retry-topology assertion, and consumer creation all happen afterwards,
  // in the background, and are not allowed to block or kill boot. See
  // startRabbitMqConsumers below for the retry/backoff loop.
  await app.listen(port);

  console.log(`\n🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/docs\n`);

  // Resolved from the HTTP app's DI container (HealthModule) so /v1/health
  // can report live consumer state — see ConsumerStatusService for why this
  // exists and health.controller.ts for how it's read.
  const consumerStatusService = app.get(ConsumerStatusService);

  // Fire-and-forget: startRabbitMqConsumers retries indefinitely on failure
  // (see RMQ_STARTUP_MAX_DELAY_MS) and is not expected to reject. The .catch
  // here is a backstop, not the primary error handling path — if this ever
  // fires it means that invariant broke, and process.on('unhandledRejection')
  // above would otherwise have been the only thing to notice.
  startRabbitMqConsumers(rabbitMqUrl, retryDelayMs, consumerStatusService).catch((err: unknown) => {
    console.error(
      '[FATAL-CANDIDATE] RabbitMQ consumer startup loop exited without retrying — this should be unreachable:',
      err instanceof Error ? err.stack ?? err.message : err,
    );
  });
}

const RMQ_STARTUP_INITIAL_DELAY_MS = 1000;
const RMQ_STARTUP_MAX_DELAY_MS = 60000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff, doubling from RMQ_STARTUP_INITIAL_DELAY_MS and capped
// at RMQ_STARTUP_MAX_DELAY_MS. Never gives up: a broker that comes back 20
// minutes after boot must be reconnected to without a container restart.
export function computeRabbitMqBackoffDelayMs(attempt: number): number {
  const delay = RMQ_STARTUP_INITIAL_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(delay, RMQ_STARTUP_MAX_DELAY_MS);
}

// Minimal structural interface instead of importing ConsumerStatusService's
// concrete type here: main.ts already reaches into shared/infrastructure for
// the class itself (bootstrap needs it to call app.get()), but the retry
// loop below only ever needs these three methods, and keeping the loop's own
// signature structural means a test double never needs to implement more
// than it uses.
export interface ConsumerStatusRecorder {
  recordAttempt(): void;
  recordConnected(): void;
  recordFailure(error: Error): void;
}

// Status reporting is diagnostic only. Swallowing here means a recorder that
// throws (an incompatible stub in a test, or a future bug in
// ConsumerStatusService) can never break the actual consumer retry loop —
// getting consumers connected always takes priority over reporting that they
// did.
function recordStatusSafely(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    console.error(
      '[rabbitmq] consumer status recorder threw; ignoring:',
      error instanceof Error ? error.stack ?? error.message : error,
    );
  }
}

// Retries connectRabbitMqConsumers indefinitely with bounded exponential
// backoff instead of throwing. A broker outage at boot (or one that starts
// mid-retry) must not crash the process — the HTTP app is already listening
// by the time this is called (see bootstrap above).
//
// statusRecorder is optional and defaults to doing nothing: main.spec.ts
// calls this with two args, and any future caller that doesn't care about
// consumer status reporting shouldn't have to construct one.
export async function startRabbitMqConsumers(
  rabbitMqUrl: string,
  retryDelayMs: number,
  statusRecorder?: ConsumerStatusRecorder,
): Promise<void> {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    recordStatusSafely(() => statusRecorder?.recordAttempt());
    try {
      await connectRabbitMqConsumers(rabbitMqUrl, retryDelayMs);
      recordStatusSafely(() => statusRecorder?.recordConnected());
      console.log(`[rabbitmq] consumers connected on attempt ${attempt}.`);
      return;
    } catch (error) {
      const delay = computeRabbitMqBackoffDelayMs(attempt);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      recordStatusSafely(() => statusRecorder?.recordFailure(normalizedError));
      console.error(
        `[rabbitmq] consumer startup failed on attempt ${attempt}; retrying in ${delay}ms:`,
        error instanceof Error ? error.stack ?? error.message : error,
      );
      await sleep(delay);
    }
  }
}

// One full attempt at bringing up RabbitMQ: topology resolution, retry
// topology, and the five consumer microservices. Throws on any failure —
// startRabbitMqConsumers is what turns that into a retry instead of a crash.
export async function connectRabbitMqConsumers(rabbitMqUrl: string, retryDelayMs: number): Promise<void> {
  const [
    auditQueueOptions,
    reportingQueueOptions,
    paymentEventsQueueOptions,
    loaEventsQueueOptions,
    reminderEventsQueueOptions,
  ] = await Promise.all([
    resolvePrimaryQueueOptions(rabbitMqUrl, AUDIT_LOG_QUEUE),
    resolvePrimaryQueueOptions(rabbitMqUrl, REPORTING_QUEUE),
    resolvePrimaryQueueOptions(rabbitMqUrl, PAYMENT_EVENTS_QUEUE),
    resolvePrimaryQueueOptions(rabbitMqUrl, LOA_EVENTS_QUEUE),
    resolvePrimaryQueueOptions(rabbitMqUrl, REMINDER_EVENTS_QUEUE),
  ]);

  await ensureRetryTopology(rabbitMqUrl, AUDIT_LOG_QUEUE, {
    retryDelayMs,
    primaryQueueOptions: auditQueueOptions,
    binding: {
      exchange: 'ybb.events',
      exchangeType: 'topic',
      routingKey: '#',
    },
  });
  await ensureRetryTopology(rabbitMqUrl, REPORTING_QUEUE, {
    retryDelayMs,
    primaryQueueOptions: reportingQueueOptions,
    binding: {
      exchange: 'ybb.events',
      exchangeType: 'topic',
      routingKey: '#',
    },
  });
  await ensureRetryTopology(rabbitMqUrl, PAYMENT_EVENTS_QUEUE, {
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
  await ensureRetryTopology(rabbitMqUrl, LOA_EVENTS_QUEUE, {
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
  await ensureRetryTopology(rabbitMqUrl, REMINDER_EVENTS_QUEUE, {
    retryDelayMs,
    primaryQueueOptions: reminderEventsQueueOptions,
    binding: {
      exchange: 'ybb.events',
      exchangeType: 'topic',
      routingKey: 'reminder.participant.send_result',
    },
  });

  // Each consumer runs in its own DI container so only its controller's
  // @EventPattern handlers are registered against its queue. This is what stops
  // the previous app-wide handler fan-out (double/triple processing). The HTTP
  // `app` created in bootstrap() intentionally has NO microservice attached.
  const deserializer = new RoutingKeyDeserializer();
  const consumerSpecs: Array<{ queue: string; module: Type<unknown>; queueOptions: PrimaryQueueOptions }> = [
    { queue: AUDIT_LOG_QUEUE, module: AuditConsumerModule, queueOptions: auditQueueOptions },
    { queue: REPORTING_QUEUE, module: ReportingConsumerModule, queueOptions: reportingQueueOptions },
    { queue: PAYMENT_EVENTS_QUEUE, module: PaymentEventsConsumerModule, queueOptions: paymentEventsQueueOptions },
    { queue: LOA_EVENTS_QUEUE, module: LoaEventsConsumerModule, queueOptions: loaEventsQueueOptions },
    { queue: REMINDER_EVENTS_QUEUE, module: ReminderEventsConsumerModule, queueOptions: reminderEventsQueueOptions },
  ];

  // M171 follow-up: connectRabbitMqConsumers is now retried by
  // startRabbitMqConsumers instead of crashing the process on failure, which
  // means a partial failure here can no longer be left for process death to
  // clean up. Track every app as soon as it is created (not just the ones
  // consumerSpecs "should" have produced — .then(push) records each one the
  // instant it resolves, regardless of ordering or of a sibling create/listen
  // call failing) so any failure below can close everything already created
  // before rethrowing. The invariant: this function either returns with all
  // five consumers listening, or leaves nothing running behind it.
  const consumerApps: Array<{ queue: string; app: INestMicroservice }> = [];
  const createPromises = consumerSpecs.map((spec) =>
    createConsumerApp(spec.module, spec.queue, spec.queueOptions, rabbitMqUrl, deserializer).then((app) => {
      consumerApps.push({ queue: spec.queue, app });
      return app;
    }),
  );

  try {
    await Promise.all(createPromises);

    await Promise.all(
      consumerApps.map(({ queue, app }) =>
        app.listen().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Consumer for queue "${queue}" failed to start: ${message}`);
        }),
      ),
    );
  } catch (error) {
    // Promise.all rejects on the FIRST rejection without cancelling (or
    // waiting for) the siblings still in flight. If spec 3's create rejects
    // while specs 4 and 5 are still pending, this catch would otherwise run
    // against whatever had pushed to consumerApps SO FAR — then 4 and 5
    // resolve afterwards and their .then(push) lands after cleanup already
    // ran, leaking both. Waiting for every create promise to settle first
    // guarantees each one has either pushed to consumerApps or definitively
    // failed by the time closeConsumerApps enumerates what to close.
    // allSettled never rejects — it is exactly what absorbs the rejections
    // from createPromises here, so none of them surfaces as an unhandled
    // rejection — and it does not replace the error we rethrow below.
    await Promise.allSettled(createPromises);
    await closeConsumerApps(consumerApps);
    throw error;
  }
}

// Best-effort cleanup for connectRabbitMqConsumers' partial-failure path.
// Each close is individually guarded so one failing close cannot mask the
// original startup error, or stop the rest of the batch from being closed.
async function closeConsumerApps(
  consumerApps: Array<{ queue: string; app: INestMicroservice }>,
): Promise<void> {
  await Promise.all(
    consumerApps.map(async ({ queue, app }) => {
      try {
        await app.close();
      } catch (closeError) {
        console.error(
          `[rabbitmq] failed to close consumer app for queue "${queue}" during startup-failure cleanup:`,
          closeError instanceof Error ? closeError.stack ?? closeError.message : closeError,
        );
      }
    }),
  );
}

export async function ensureRetryTopology(
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
  } catch (error) {
    if (isQueuePreconditionFailure(error)) {
      // M171: give ensureRetryTopology the same 406 PRECONDITION_FAILED
      // tolerance resolvePrimaryQueueOptions already has for the primary
      // queue. Without this, a changed RABBITMQ_RETRY_DELAY_MS (which changes
      // the x-message-ttl argument this function asserts on `${queueName}.retry`)
      // crash-loops the whole API against an already-declared queue. Leave the
      // existing topology in place and log loudly instead of throwing.
      console.warn(
        `[rabbitmq] retry topology assertion for queue "${queueName}" hit 406 PRECONDITION_FAILED — ` +
        `the existing queue was declared with different arguments (check RABBITMQ_RETRY_DELAY_MS ` +
        `against x-message-ttl on ${queueName}.retry, and services/shared-rabbitmq/scripts/init_rabbitmq.py, ` +
        `which pre-declares some of these queues). Leaving the existing topology in place instead of crashing.`,
      );
      return;
    }

    // Name the queue. A channel-level broker error here is almost always an
    // argument mismatch against a queue that already exists, and the amqplib
    // error alone says only "Channel closed" — see the finally block below.
    throw new Error(
      `RabbitMQ topology assertion failed for queue "${queueName}": ${
        error instanceof Error ? error.message : String(error)
      }. If this is a precondition_failed, the existing queue was declared with ` +
      `different arguments (check RABBITMQ_RETRY_DELAY_MS against x-message-ttl ` +
      `on ${queueName}.retry, and services/shared-rabbitmq/scripts/init_rabbitmq.py, ` +
      `which pre-declares some of these queues).`,
    );
  } finally {
    // Best-effort, and that matters. On a channel-level error the broker has
    // ALREADY closed the channel, so close() throws IllegalOperationError — and
    // throwing from a finally block REPLACES the real error. That is exactly how
    // an x-message-ttl mismatch reached production as a bare "Channel closed"
    // crash loop with no mention of the queue or the argument, while the real
    // precondition_failed was visible only in the broker's own log.
    await channel.close().catch(() => undefined);
    await connection.close().catch(() => undefined);
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

// Only auto-run bootstrap() when this file is the Node entry point, not when
// it is imported (e.g. by main.spec.ts) — kept at the bottom of the file, after
// every const/function it touches, so there is no TDZ hazard from reading
// bootstrap or anything it closes over before module evaluation finishes.
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
