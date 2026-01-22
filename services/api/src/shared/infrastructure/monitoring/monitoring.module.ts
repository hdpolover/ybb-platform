import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsController } from '../../presentation/metrics.controller';

@Module({
    providers: [MetricsService],
    exports: [MetricsService],
    controllers: [],
})
export class MonitoringModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(MetricsMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
