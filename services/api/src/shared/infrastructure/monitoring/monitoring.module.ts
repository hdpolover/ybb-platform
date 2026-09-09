import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { MetricsCoreModule } from './metrics-core.module';
import { MetricsMiddleware } from './metrics.middleware';
import { QueueMonitoringService } from './queue-monitoring.service';

// Full monitoring surface: HTTP request metrics middleware + RabbitMQ
// queue-depth polling, on top of the MetricsCoreModule every process gets.
// This module is for the HTTP app (and anything that genuinely needs queue
// depth, e.g. an admin purge-queue action) -- NOT for RMQ consumer bootstraps,
// which have no HTTP surface for MetricsMiddleware to attach to and no reader
// for QueueMonitoringService's gauges (each DI container owns its own
// prom-client registry, and only the HTTP app's registry is ever scraped via
// /metrics). See bootstrap/consumer-infra.module.ts, which imports
// MetricsCoreModule directly instead of this module.
@Module({
    imports: [MetricsCoreModule],
    providers: [QueueMonitoringService],
    exports: [MetricsCoreModule, QueueMonitoringService],
    controllers: [],
})
export class MonitoringModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(MetricsMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
