import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { MetricsMiddleware } from './metrics.middleware';
import { QueueMonitoringService } from './queue-monitoring.service';
import { MetricsController } from '../../presentation/metrics.controller';

@Module({
    imports: [ConfigModule],
    providers: [MetricsService, QueueMonitoringService],
    exports: [MetricsService, QueueMonitoringService],
    controllers: [],
})
export class MonitoringModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(MetricsMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
