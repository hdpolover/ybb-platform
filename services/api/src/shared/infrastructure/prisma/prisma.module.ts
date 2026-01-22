import { Module, Global } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { PrismaService } from './prisma.service';

/**
 * Prisma Module
 * 
 * Infrastructure Layer - Database Module
 * 
 * This module is marked as @Global() to make PrismaService available
 * throughout the application without needing to import it in every module.
 * 
 * This follows NestJS best practices for shared infrastructure services.
 */
@Global()
@Module({
  imports: [MonitoringModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
