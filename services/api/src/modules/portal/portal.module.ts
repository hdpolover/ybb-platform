import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PortalController } from './presentation/portal.controller';
import { GetPortalDashboardHandler } from './application/queries/handlers/get-portal-dashboard.handler';
import { GetPortalSubmissionsHandler } from './application/queries/handlers/get-portal-submissions.handler';
import { GetPortalPaymentsHandler } from './application/queries/handlers/get-portal-payments.handler';
import { GetPortalDocumentsHandler } from './application/queries/handlers/get-portal-documents.handler';

@Module({
    imports: [CqrsModule, AuthModule],
    controllers: [PortalController],
    providers: [
        GetPortalDashboardHandler,
        GetPortalSubmissionsHandler,
        GetPortalPaymentsHandler,
        GetPortalDocumentsHandler
    ],
})
export class PortalModule {}
