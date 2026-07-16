import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsController } from './events.controller';
import { EmailModule } from '../email/email.module';
import { NotificationIdempotencyService } from './notification-idempotency.service';

@Module({
  imports: [ConfigModule, EmailModule],
  controllers: [EventsController],
  providers: [NotificationIdempotencyService],
})
export class EventsModule {}
