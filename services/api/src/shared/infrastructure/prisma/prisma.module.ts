import { Module, Global } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { PrismaService } from './prisma.service';
import { PrismaReadService } from './prisma-read.service';
import { TransactionService } from '../database/transaction.service';
import { UnitOfWork } from '../database/unit-of-work.service';
import { DataChangeLogService } from '../../services/data-change-log.service';

/**
 * Prisma Module
 * 
 * Infrastructure Layer - Database Module
 * 
 * This module is marked as @Global() to make PrismaService, TransactionService,
 * UnitOfWork, and DataChangeLogService available throughout the application
 * without needing to import it in every module.
 * 
 * This follows NestJS best practices for shared infrastructure services.
 */
@Global()
@Module({
  imports: [MonitoringModule],
  providers: [PrismaService, PrismaReadService, TransactionService, UnitOfWork, DataChangeLogService],
  exports: [PrismaService, PrismaReadService, TransactionService, UnitOfWork, DataChangeLogService],
})
export class PrismaModule { }
