import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditAdminController } from './audit-admin.controller';
import { AuditCleanupService } from './audit-cleanup.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { ExcelModule } from '../../shared/infrastructure/excel/excel.module';
import { AuditTrailInterceptor } from '../../shared/interceptors/audit-trail.interceptor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, ExcelModule, AuthModule],
  controllers: [AuditController, AuditAdminController],
  providers: [
    AuditService,
    AuditCleanupService,
    // Register AuditTrailInterceptor as a global interceptor via DI
    // (needed because it depends on Reflector, PrismaService, DataChangeLogService)
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditTrailInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule { }

