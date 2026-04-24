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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Connect Microservice for Event Consumption (Audit Logging)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/'],
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
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/'],
      queue: 'reporting_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false,
      prefetchCount: 1,
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
  // Rewrite CDN UUID-file URLs to proxy paths so raw CDN paths never reach clients
  app.useGlobalInterceptors(new CdnMaskInterceptor());

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
