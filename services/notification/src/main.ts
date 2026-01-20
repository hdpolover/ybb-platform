import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { InboundMessageDeserializer } from './common/deserializers/inbound-message.deserializer';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/'],
      queue: 'notification_queue',
      queueOptions: {
        durable: true,
      },
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

  console.log(`\n🚀 Notification Service is running on: http://localhost:${process.env.PORT || 4002}`);
  console.log(`📚 API Documentation: http://localhost:${process.env.PORT || 4002}/api/docs\n`);
}
bootstrap();
