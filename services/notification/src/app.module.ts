import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { MetricsController } from './metrics.controller';
import { AppService } from './app.service';
import { EmailModule } from './modules/email/email.module';
import { EventsModule } from './modules/events/events.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
// @ts-ignore
import LokiTransport from 'winston-loki';
import { trace, context } from '@opentelemetry/api';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const lokiUrl =
          configService.get<string>('LOKI_URL') || 'http://loki:3100';
        const LokiTransportConstructor =
          (LokiTransport as any).default || LokiTransport;
        return {
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
                winston.format.colorize(),
                winston.format.printf(
                  ({ timestamp, level, message, context, ...meta }: any) => {
                    return `${timestamp} [${context || 'Application'}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
                  },
                ),
              ),
            }),
            new LokiTransportConstructor({
              host: lokiUrl,
              labels: { job: 'ybb-notification' },
              json: true,
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format((info: any) => {
                  const span = trace.getSpan(context.active());
                  if (span) {
                    const spanContext = span.spanContext();
                    info.traceId = spanContext.traceId;
                    info.spanId = spanContext.spanId;
                  }
                  return info;
                })(),
                winston.format.json(),
              ),
              replaceTimestamp: true,
            }),
          ],
        };
      },
    }),
    EmailModule,
    EventsModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule {}
