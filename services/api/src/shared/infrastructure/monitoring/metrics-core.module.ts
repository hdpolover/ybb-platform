import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsService } from './metrics.service';

/**
 * Minimal metrics surface every process needs, HTTP app or RMQ consumer alike:
 * PrismaService and CacheService record query/cache metrics through
 * MetricsService regardless of whether the process ever serves HTTP traffic.
 *
 * Split out from MonitoringModule so a process that imports PrismaModule (all
 * of them -- it is @Global) does not also transitively get QueueMonitoringService
 * (opens its own AMQP connection and polls every 15s) or MetricsMiddleware (an
 * Express middleware with no Express routes to attach to in a pure RMQ consumer).
 * Both of those are HTTP-app-only and belong in MonitoringModule, which now
 * imports this module rather than declaring its own MetricsService provider.
 */
@Module({
    imports: [ConfigModule],
    providers: [MetricsService],
    exports: [MetricsService],
})
export class MetricsCoreModule {}
