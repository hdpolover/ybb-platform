import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [EmailModule],
    controllers: [EventsController],
})
export class EventsModule { }
