// services/api/src/shared/interceptors/audit-trail-admin-coverage.spec.ts
import { Reflector } from '@nestjs/core';
import { ChangeType } from '@prisma/client';
import { AUDIT_TRAIL_KEY, AuditTrailMetadata } from '../decorators/audit-trail.decorator';
import { AdminRolesController } from '../../modules/admins/presentation/admin-roles.controller';
import { ApplicationsController } from '../../modules/applications/presentation/applications.controller';
import { AuditAdminController } from '../../modules/audit/audit-admin.controller';
import { AuthProviderController } from '../../modules/auth/presentation/auth-provider.controller';
import { AdminMediaController } from '../../modules/files/presentation/admin-media.controller';
import { PaymentAdminController } from '../../modules/payments/presentation/payment-admin.controller';
import { PaymentReconciliationController } from '../../modules/payments/presentation/payment-reconciliation.controller';
import { PlatformSettingsController } from '../../modules/platform-settings/presentation/platform-settings.controller';
import { ContentTemplatesController } from '../../modules/programs/presentation/content-templates.controller';
import { ProgramApplicationConfigController } from '../../modules/programs/presentation/program-application.controller';
import { ProgramContentController } from '../../modules/programs/presentation/program-content.controller';
import { ProgramCopyController } from '../../modules/programs/presentation/program-copy.controller';
import { ProgramParticipationController } from '../../modules/programs/presentation/program-participation.controller';
import { ProgramPeopleController } from '../../modules/programs/presentation/program-people.controller';
import { ProgramScheduleController } from '../../modules/programs/presentation/program-schedule.controller';
import { ProgramScoringController } from '../../modules/programs/presentation/program-scoring.controller';
import { ProgramsController } from '../../modules/programs/presentation/programs.controller';
import { SystemFormFieldsController } from '../../modules/programs/presentation/system-form-fields.controller';
import { ReadinessController } from '../../modules/readiness/presentation/readiness.controller';
import { ParticipantRemindersController } from '../../modules/reminders/presentation/participant-reminders.controller';
import { SystemAnnouncementsController } from '../../modules/system/presentation/system-announcements.controller';
import { DeletionRequestsController } from '../../modules/users/presentation/deletion-requests.controller';
import { QueueController } from '../presentation/queue.controller';

// The interceptor is wired app-wide (audit.module.ts) and acts on this metadata
// alone, so the metadata is what proves a write route is audited. One row per
// fixed controller, plus every route whose idParam or bodyFields matters.
type Handler = (...args: never[]) => unknown;
type Row = [string, { prototype: object }, string, AuditTrailMetadata];

const rows: Row[] = [
    ['admin roles: create', AdminRolesController, 'createRole', { entityType: 'AdminRole', action: ChangeType.create }],
    ['admin roles: update (permissions)', AdminRolesController, 'updateRole', { entityType: 'AdminRole', action: ChangeType.update }],
    ['admin roles: delete', AdminRolesController, 'deleteRole', { entityType: 'AdminRole', action: ChangeType.delete }],
    ['payments: verify records the approve/reject choice', PaymentAdminController, 'verifyInvoice', { entityType: 'ApplicationInvoice', action: ChangeType.status_change, bodyFields: ['action', 'reason'] }],
    ['payments: status override records the override justification', PaymentAdminController, 'updateInvoiceStatus', { entityType: 'ApplicationInvoice', action: ChangeType.status_change, bodyFields: ['status', 'reason', 'manualOverride', 'overrideReason'] }],
    ['payments: reconciliation', PaymentReconciliationController, 'reconcile', { entityType: 'PaymentReconciliation', action: ChangeType.bulk_update }],
    ['applications: review upsert', ApplicationsController, 'upsertReview', { entityType: 'ApplicationReview', action: ChangeType.update, idParam: 'applicationId' }],
    ['audit logs: cleanup', AuditAdminController, 'cleanup', { entityType: 'DataChangeLog', action: ChangeType.delete }],
    ['auth providers: update', AuthProviderController, 'update', { entityType: 'AuthProvider', action: ChangeType.update }],
    ['admin media: upload keyed on program', AdminMediaController, 'uploadMedia', { entityType: 'ProgramMedia', action: ChangeType.create, idParam: 'programId' }],
    ['platform settings: impact stats', PlatformSettingsController, 'updateImpactStats', { entityType: 'PlatformSetting', action: ChangeType.update }],
    ['content templates: update', ContentTemplatesController, 'update', { entityType: 'ContentTemplate', action: ChangeType.update }],
    ['program application config: form field update', ProgramApplicationConfigController, 'updateFormField', { entityType: 'ApplicationFormField', action: ChangeType.update, idParam: 'itemId' }],
    ['program content: faq delete', ProgramContentController, 'deleteFaq', { entityType: 'ProgramFaq', action: ChangeType.delete, idParam: 'itemId' }],
    ['program content: LOA batch release', ProgramContentController, 'releaseLoaBatch', { entityType: 'LoaReleaseBatch', action: ChangeType.status_change }],
    ['program copy: copy is a bulk write', ProgramCopyController, 'copy', { entityType: 'Program', action: ChangeType.bulk_update, idParam: 'programId' }],
    ['program participation: delete', ProgramParticipationController, 'delete', { entityType: 'ProgramParticipationInfo', action: ChangeType.delete }],
    ['program people: speaker add', ProgramPeopleController, 'addSpeaker', { entityType: 'ProgramSpeaker', action: ChangeType.create }],
    ['program schedule: timeline update', ProgramScheduleController, 'updateTimeline', { entityType: 'ProgramTimeline', action: ChangeType.update, idParam: 'itemId' }],
    ['program scoring: rubric upsert', ProgramScoringController, 'upsertScoringRubric', { entityType: 'ScoringSchema', action: ChangeType.update, idParam: 'programId' }],
    ['programs: landing content', ProgramsController, 'updateLandingContent', { entityType: 'Program', action: ChangeType.update }],
    ['system form fields: remove', SystemFormFieldsController, 'remove', { entityType: 'SystemFormFieldDefinition', action: ChangeType.delete }],
    ['readiness: override', ReadinessController, 'createOverride', { entityType: 'ReadinessOverride', action: ChangeType.create }],
    ['reminders: cancel', ParticipantRemindersController, 'cancel', { entityType: 'ParticipantReminder', action: ChangeType.status_change }],
    ['system announcements: publish toggle', SystemAnnouncementsController, 'adminTogglePublish', { entityType: 'SystemAnnouncement', action: ChangeType.status_change }],
    ['deletion requests: review', DeletionRequestsController, 'review', { entityType: 'AccountDeletionRequest', action: ChangeType.status_change }],
    ['queue: purge', QueueController, 'purgeQueues', { entityType: 'MessageQueue', action: ChangeType.bulk_update }],
];

describe('admin write routes carry @AuditTrail', () => {
    const reflector = new Reflector();

    it.each(rows)('%s', (_label, controller, method, expected) => {
        const handler = (controller.prototype as Record<string, unknown>)[method] as Handler;
        expect(reflector.get<AuditTrailMetadata>(AUDIT_TRAIL_KEY, handler)).toEqual(expected);
    });
});
