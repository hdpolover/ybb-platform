import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : process.env.CORS_ORIGIN || 'http://localhost:3001';

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
  await app.listen(port);

  console.log(`\n🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/docs\n`);
}

bootstrap();
