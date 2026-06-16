import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { FilesModule } from '../files/files.module';
import { ParticipantsModule } from '../participants/participants.module';

// Existing
import { PortalController } from './presentation/portal.controller';
import { GetPortalDashboardHandler } from './application/queries/handlers/get-portal-dashboard.handler';
import { GetPortalSubmissionsHandler } from './application/queries/handlers/get-portal-submissions.handler';
import { GetPortalPaymentsHandler } from './application/queries/handlers/get-portal-payments.handler';
import { GetPortalPaymentDetailHandler } from './application/queries/handlers/get-portal-payment-detail.handler';
import { GetPortalDocumentsHandler } from './application/queries/handlers/get-portal-documents.handler';
import { PortalCacheService } from './application/services/portal-cache.service';
import { PortalReceiptService } from './application/services/portal-receipt.service';
import { LoaEligibilityService } from './application/services/loa-eligibility.service';
import { LoaDocumentNumberService } from './application/services/loa-document-number.service';
import { LoaDownloadService } from './application/services/loa-download.service';
import { ConfirmPortalPaymentHandler } from './application/commands/handlers/confirm-portal-payment.handler';
import { CancelPortalPaymentHandler } from './application/commands/handlers/cancel-portal-payment.handler';
import { EnsurePortalPaymentInvoiceHandler } from './application/commands/handlers/ensure-portal-payment-invoice.handler';

// New — Submissions
import { PortalSubmissionsController } from './presentation/portal-submissions.controller';
import { GetPortalSubmissionDetailHandler } from './application/queries/handlers/get-portal-submission-detail.handler';
import { SaveSubmissionSectionHandler } from './application/commands/handlers/save-submission-section.handler';
import { PortalSubmitApplicationHandler } from './application/commands/handlers/portal-submit-application.handler';

// New — Certificates
import { PortalCertificatesController } from './presentation/portal-certificates.controller';
import { GetPortalCertificatesHandler } from './application/queries/handlers/get-portal-certificates.handler';
import { DownloadCertificateHandler } from './application/commands/handlers/download-certificate.handler';

// New — Documents
import { UploadSignedCopyHandler } from './application/commands/handlers/upload-signed-copy.handler';

@Module({
    imports: [CqrsModule, AuthModule, PaymentsModule, FilesModule, ParticipantsModule],
    controllers: [
        PortalController,
        PortalSubmissionsController,
        PortalCertificatesController,
    ],
    providers: [
        PortalCacheService,
        PortalReceiptService,
        LoaEligibilityService,
        LoaDocumentNumberService,
        LoaDownloadService,
        // Existing query handlers
        GetPortalDashboardHandler,
        GetPortalSubmissionsHandler,
        GetPortalPaymentsHandler,
        GetPortalPaymentDetailHandler,
        GetPortalDocumentsHandler,
        // New query handlers
        GetPortalSubmissionDetailHandler,
        GetPortalCertificatesHandler,
        // Command handlers
        SaveSubmissionSectionHandler,
        PortalSubmitApplicationHandler,
        DownloadCertificateHandler,
        ConfirmPortalPaymentHandler,
        CancelPortalPaymentHandler,
        EnsurePortalPaymentInvoiceHandler,
        UploadSignedCopyHandler,
    ],
})
export class PortalModule { }
