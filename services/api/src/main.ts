import './tracing';
// BigInt has no JSON serializer by default — convert to number when safe, string otherwise
(BigInt.prototype as any).toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { CdnMaskInterceptor } from './shared/interceptors/cdn-mask.interceptor';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service';
import * as amqp from 'amqplib';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const rabbitMqUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/';
  const retryDelayMs = parsePositiveInt(process.env.RABBITMQ_RETRY_DELAY_MS, 15000);

  await ensureRetryTopology(rabbitMqUrl, 'audit_log_queue', { retryDelayMs });
  await ensureRetryTopology(rabbitMqUrl, 'reporting_queue', { retryDelayMs });
  await ensureRetryTopology(rabbitMqUrl, 'api-service-payment-events', {
    retryDelayMs,
    binding: {
      exchange: 'payment-events',
      exchangeType: 'topic',
      routingKey: 'payment.#',
    },
  });

  // Connect Microservice for Event Consumption (Audit Logging)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: 'audit_log_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false,
      prefetchCount: 1,
    },
  });

  // Connect Microservice for Reporting Queue
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: 'reporting_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false,
      prefetchCount: 1,
    },
  });

  // Connect Microservice for Payment Events (from Go payment service).
  // The Go service publishes to the `payment-events` topic exchange. We declare
  // a dedicated durable queue and bind it via topic routing so payment-events
  // controller's @EventPattern handlers actually receive the events. Without
  // this binding, payment.succeeded / payment.failed events are dropped.
  // Custom deserializer maps the AMQP routing key to the NestJS pattern,
  // because the Go publisher emits raw payloads (no { pattern, data } envelope).
  const { RoutingKeyDeserializer } = await import('./shared/infrastructure/rabbitmq/routing-key-deserializer');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: 'api-service-payment-events',
      exchange: 'payment-events',
      exchangeType: 'topic',
      routingKey: 'payment.#',
      wildcards: true,
      queueOptions: {
        durable: true,
      },
      noAck: false,
      prefetchCount: 1,
      deserializer: new RoutingKeyDeserializer(),
    },
  });

  // Use Winston Logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

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
    binding?: {
      exchange: string;
      exchangeType: 'topic' | 'direct' | 'fanout' | 'headers';
      routingKey: string;
    };
  },
) {
  const connection = await amqp.connect(rabbitMqUrl);
  const channel = await connection.createChannel();

  try {
    if (options.binding) {
      await channel.assertExchange(options.binding.exchange, options.binding.exchangeType, {
        durable: true,
      });
    }

    await channel.assertQueue(queueName, {
      durable: true,
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
