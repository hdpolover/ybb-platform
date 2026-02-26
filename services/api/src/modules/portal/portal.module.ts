import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';

// Existing
import { PortalController } from './presentation/portal.controller';
import { GetPortalDashboardHandler } from './application/queries/handlers/get-portal-dashboard.handler';
import { GetPortalSubmissionsHandler } from './application/queries/handlers/get-portal-submissions.handler';
import { GetPortalPaymentsHandler } from './application/queries/handlers/get-portal-payments.handler';
import { GetPortalDocumentsHandler } from './application/queries/handlers/get-portal-documents.handler';
import { PortalCacheService } from './application/services/portal-cache.service';

// New — Submissions
import { PortalSubmissionsController } from './presentation/portal-submissions.controller';
import { GetPortalSubmissionDetailHandler } from './application/queries/handlers/get-portal-submission-detail.handler';
import { SaveSubmissionSectionHandler } from './application/commands/handlers/save-submission-section.handler';
import { PortalSubmitApplicationHandler } from './application/commands/handlers/portal-submit-application.handler';

// New — Certificates
import { PortalCertificatesController } from './presentation/portal-certificates.controller';
import { GetPortalCertificatesHandler } from './application/queries/handlers/get-portal-certificates.handler';
import { DownloadCertificateHandler } from './application/commands/handlers/download-certificate.handler';

@Module({
    imports: [CqrsModule, AuthModule],
    controllers: [
        PortalController,
        PortalSubmissionsController,
        PortalCertificatesController,
    ],
    providers: [
        PortalCacheService,
        // Existing query handlers
        GetPortalDashboardHandler,
        GetPortalSubmissionsHandler,
        GetPortalPaymentsHandler,
        GetPortalDocumentsHandler,
        // New query handlers
        GetPortalSubmissionDetailHandler,
        GetPortalCertificatesHandler,
        // New command handlers
        SaveSubmissionSectionHandler,
        PortalSubmitApplicationHandler,
        DownloadCertificateHandler,
    ],
})
export class PortalModule { }

