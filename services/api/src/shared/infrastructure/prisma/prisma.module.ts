import { Module, Global } from '@nestjs/common';
import { MetricsCoreModule } from '../monitoring/metrics-core.module';
import { PrismaService } from './prisma.service';
import { PrismaReadService } from './prisma-read.service';
import { TransactionService } from '../database/transaction.service';
import { UnitOfWork } from '../database/unit-of-work.service';
import { CronLockService } from '../database/cron-lock.service';
import { DataChangeLogService } from '../../services/data-change-log.service';

/**
 * Prisma Module
 *
 * Infrastructure Layer - Database Module
 *
 * This module is marked as @Global() to make PrismaService, TransactionService,
 * UnitOfWork, CronLockService, and DataChangeLogService available throughout
 * the application without needing to import it in every module.
 *
 * This follows NestJS best practices for shared infrastructure services.
 *
 * Imports MetricsCoreModule (MetricsService only), not the full MonitoringModule:
 * PrismaModule is @Global and therefore compiled into every DI container in the
 * process, including every RMQ consumer bootstrap (see bootstrap/consumer-infra.module.ts).
 * Importing the full MonitoringModule here used to mean every consumer container
 * transitively got QueueMonitoringService (its own AMQP connection + 15s poll
 * loop) and MetricsMiddleware (an Express middleware with no routes to attach
 * to in a microservice-only app) purely as a side effect of needing PrismaService's
 * query-duration metrics. Processes that actually need the full surface (the
 * HTTP app) import MonitoringModule directly.
 */
@Global()
@Module({
  imports: [MetricsCoreModule],
  providers: [PrismaService, PrismaReadService, TransactionService, UnitOfWork, CronLockService, DataChangeLogService],
  exports: [PrismaService, PrismaReadService, TransactionService, UnitOfWork, CronLockService, DataChangeLogService],
})
export class PrismaModule { }
