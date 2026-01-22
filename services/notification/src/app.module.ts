import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { MetricsController } from './metrics.controller';
import { AppService } from './app.service';
import { EmailModule } from './modules/email/email.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EmailModule,
    EventsModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule { }
