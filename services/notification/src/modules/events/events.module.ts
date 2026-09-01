import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsController } from './events.controller';
import { EmailModule } from '../email/email.module';
import { NotificationIdempotencyService } from './notification-idempotency.service';
import { RabbitMQProducerModule } from '../../shared/rabbitmq/rabbitmq-producer.module';

@Module({
  imports: [ConfigModule, EmailModule, RabbitMQProducerModule],
  controllers: [EventsController],
  providers: [NotificationIdempotencyService],
})
export class EventsModule {}
