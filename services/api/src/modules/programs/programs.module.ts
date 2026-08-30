import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { FilesModule } from '@modules/files/files.module';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { LandingRevalidationService } from '../brands/application/services/landing-revalidation.service';
import { LandingCacheInvalidationService } from '../brands/application/services/landing-cache-invalidation.service';
import { ProgramsController } from './presentation/programs.controller';
import { AdminProgramsController } from './presentation/admin-programs.controller';
import { ProgramScheduleController } from './presentation/program-schedule.controller';
import { ProgramPeopleController } from './presentation/program-people.controller';
import { ProgramContentController } from './presentation/program-content.controller';
import { ProgramApplicationConfigController } from './presentation/program-application.controller';
import { ProgramParticipationController } from './presentation/program-participation.controller';
import { ProgramLandingController } from './presentation/program-landing.controller';
import { ProgramExchangeRateController } from './presentation/program-exchange-rate.controller';
import { ProgramAnnouncementsController } from './presentation/program-announcements.controller';
import { SystemFormFieldsController } from './presentation/system-form-fields.controller';
import { ContentTemplatesController } from './presentation/content-templates.controller';
import { ProgramFormFieldsController } from './presentation/program-form-fields.controller';
import { ProgramScoringController } from './presentation/program-scoring.controller';
import { ProgramCopyController } from './presentation/program-copy.controller';
import { GetScoringRubricsHandler } from './application/queries/handlers/get-scoring-rubrics.handler';
import { GetScoringRubricVersionsHandler } from './application/queries/handlers/get-scoring-rubric-versions.handler';
import { UpsertScoringRubricHandler } from './application/commands/handlers/upsert-scoring-rubric.handler';
import { ScoringRubricRepository } from './infrastructure/persistence/scoring-rubric.repository';
import {
  CreateContentTemplateHandler,
  UpdateContentTemplateHandler,
  DeleteContentTemplateHandler,
} from './application/commands/handlers/content-template.handler';
import { ProgramCopierRegistry } from './application/copy/program-copier.registry';
import { ProgramCopier } from './application/copy/program-copier.interface';
import { FormFieldsCopier } from './application/copy/copiers/form-fields.copier';
import { ParticipationCategoriesCopier } from './application/copy/copiers/participation-categories.copier';
import { TimelinesCopier } from './application/copy/copiers/timelines.copier';
import { RundownsCopier } from './application/copy/copiers/rundowns.copier';
import { FaqsCopier } from './application/copy/copiers/faqs.copier';
import { PaymentsCopier } from './application/copy/copiers/payments.copier';
import { ProgramDetailsCopier } from './application/copy/copiers/program-details.copier';
import { ContactCopier } from './application/copy/copiers/contact.copier';
import { LandingCopier } from './application/copy/copiers/landing.copier';
import { SpeakersCopier } from './application/copy/copiers/speakers.copier';
import { TestimonialsCopier } from './application/copy/copiers/testimonials.copier';
import {
  GetContentTemplatesHandler,
  GetContentTemplateByIdHandler,
} from './application/queries/handlers/get-content-templates.handler';
import {
  ListProgramAnnouncementsHandler,
  GetProgramAnnouncementHandler,
  CreateProgramAnnouncementHandler,
  UpdateProgramAnnouncementHandler,
  DeleteProgramAnnouncementHandler,
} from './application/commands/handlers/manage-program-announcements.handler';
import {
  UpsertParticipationInfoHandler,
  DeleteParticipationInfoHandler,
  GetParticipationInfoHandler,
  ListParticipationInfoHandler,
} from './application/handlers/participation-info.handlers';
import { ListProgramsHandler } from './application/queries/handlers/list-programs.handler';
import { GetProgramDetailHandler } from './application/queries/handlers/get-program-detail.handler';
import { GetProgramLandingHandler } from './application/queries/handlers/get-program-landing.handler';
import { CreateProgramHandler } from './application/commands/handlers/create-program.handler';
import { UpdateProgramHandler } from './application/commands/handlers/update-program.handler';
import { DeleteProgramHandler } from './application/commands/handlers/delete-program.handler';
import { UpdateProgramBrandingHandler } from './application/commands/handlers/update-program-branding.handler';
import {
  ListProgramTimelineHandler,
  ListProgramSchedulesHandler,
  ListProgramSpeakersHandler,
  ListProgramGalleryHandler,
  ListProgramTestimonialsHandler,
  ListProgramFaqsHandler,
  ListProgramTeamHandler,
  ListProgramPartnersHandler,
  ListProgramResourcesHandler,
  ListProgramPricingTiersHandler,
  GetPricingTierByIdHandler,
  GetPricingTierAlertsHandler,
  ListProgramRequirementsHandler,
  ListProgramEssaysHandler,
  ListProgramParticipationCategoriesHandler,
  ListProgramSubthemesHandler,
  ListDocumentTemplatesHandler,
} from './application/queries/handlers/list-program-content.handlers';
import { GetPricingTierAlertsSummaryHandler } from './application/queries/handlers/get-pricing-tier-alerts-summary.handler';
import {
  CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
  CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler,
  CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
  CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
  CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
  CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
  CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
  CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler,
  CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
  CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
  CreateValidityPeriodHandler, UpdateValidityPeriodHandler, DeleteValidityPeriodHandler,
  CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
  CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler, UpdateProgramEssayGuidelinesHandler,
  CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
  CreateProgramSubthemeHandler, UpdateProgramSubthemeHandler, DeleteProgramSubthemeHandler,
  CreateDocumentTemplateHandler, UpdateDocumentTemplateHandler, DeleteDocumentTemplateHandler,
  UpdateProgramPaymentInfoHandler,
  UpdateProgramContactHandler,
  UpdateProgramLandingContentHandler,
} from './application/commands/handlers/manage-program-content.handlers';
import {
  CreateApplicationFormFieldHandler,
  UpdateApplicationFormFieldHandler,
  DeleteApplicationFormFieldHandler,
} from './application/commands/handlers/application-form-field.handler';
import {
  CreateSystemFormFieldHandler,
  UpdateSystemFormFieldHandler,
  DeleteSystemFormFieldHandler,
} from './application/commands/handlers/system-form-field.handler';
import { GetApplicationFormFieldsHandler } from './application/queries/handlers/get-application-form-fields.handler';
import { GetSystemFormFieldsHandler } from './application/queries/handlers/get-system-form-fields.handler';
import { GetParticipantProgressHandler } from './application/queries/handlers/get-participant-progress.handler';
import { UpdateExchangeRateHandler } from './application/commands/handlers/update-exchange-rate.handler';
import { ProgramContentRepository } from './infrastructure/persistence/program-content.repository';
import { ProgramRepository } from './infrastructure/persistence/program.repository';
import { LoaReleaseBatchRepository } from './infrastructure/persistence/loa-release-batch.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { FormFieldKeyValidator } from './application/validators/form-field-key.validator';
import {
  CreateLoaBatchHandler,
  UpdateLoaBatchHandler,
  ReleaseLoaBatchHandler,
  UnreleaseLoaBatchHandler,
  DeleteLoaBatchHandler,
  GetLoaBatchesHandler,
  GetLoaDownloadsHandler,
} from './application/handlers/loa-batch.handlers';
import { PreviewLoaTemplateHandler } from './application/handlers/loa-preview.handler';
import { PortalModule } from '@modules/portal/portal.module';
import { LoaPreviewParticipantService } from './application/services/loa-preview-participant.service';

@Module({
  imports: [CqrsModule, HttpModule, AuthModule, UsersModule, FilesModule, RabbitMQModule, PortalModule],
  controllers: [
    ProgramsController,
    AdminProgramsController,
    ProgramScheduleController,
    ProgramPeopleController,
    ProgramContentController,
    ProgramApplicationConfigController,
    ProgramParticipationController,
    ProgramLandingController,
    ProgramExchangeRateController,
    ProgramAnnouncementsController,
    SystemFormFieldsController,
    ContentTemplatesController,
    ProgramFormFieldsController,
    ProgramScoringController,
    ProgramCopyController,
  ],
  providers: [
    ListProgramsHandler,
    GetProgramDetailHandler,
    GetProgramLandingHandler,
    CreateProgramHandler,
    UpdateProgramHandler,
    UpdateProgramBrandingHandler,
    DeleteProgramHandler,
    GetParticipantProgressHandler,
    UpdateExchangeRateHandler,
    // Content Handlers
    ListProgramTimelineHandler,
    ListProgramSchedulesHandler,
    ListProgramSpeakersHandler,
    ListProgramGalleryHandler,
    ListProgramTestimonialsHandler,
    ListProgramFaqsHandler,
    ListProgramTeamHandler,
    ListProgramPartnersHandler,
    ListProgramResourcesHandler,
    ListProgramPricingTiersHandler,
    GetPricingTierByIdHandler,
    GetPricingTierAlertsHandler,
    GetPricingTierAlertsSummaryHandler,
    ListProgramRequirementsHandler,
    ListProgramEssaysHandler,
    ListProgramParticipationCategoriesHandler,
    ListProgramSubthemesHandler,
    ListDocumentTemplatesHandler,
    // Content Management Handlers
    CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
    CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler,
    CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
    CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
    CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
    CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
    CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
    CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler,
    CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
    CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
    CreateValidityPeriodHandler, UpdateValidityPeriodHandler, DeleteValidityPeriodHandler,
    CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
    CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler, UpdateProgramEssayGuidelinesHandler,
    CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
    CreateProgramSubthemeHandler, UpdateProgramSubthemeHandler, DeleteProgramSubthemeHandler,
    CreateDocumentTemplateHandler, UpdateDocumentTemplateHandler, DeleteDocumentTemplateHandler,
    UpdateProgramPaymentInfoHandler,
    UpdateProgramContactHandler,
    UpdateProgramLandingContentHandler,
    // Form Field Handlers
    CreateApplicationFormFieldHandler,
    UpdateApplicationFormFieldHandler,
    DeleteApplicationFormFieldHandler,
    GetApplicationFormFieldsHandler,
    GetSystemFormFieldsHandler,
    CreateSystemFormFieldHandler,
    UpdateSystemFormFieldHandler,
    DeleteSystemFormFieldHandler,

    // Content Template Handlers
    CreateContentTemplateHandler,
    UpdateContentTemplateHandler,
    DeleteContentTemplateHandler,
    GetContentTemplatesHandler,
    GetContentTemplateByIdHandler,

    // Program Content Copy
    FormFieldsCopier,
    ParticipationCategoriesCopier,
    TimelinesCopier,
    RundownsCopier,
    FaqsCopier,
    PaymentsCopier,
    ProgramDetailsCopier,
    ContactCopier,
    LandingCopier,
    SpeakersCopier,
    TestimonialsCopier,
    {
      provide: ProgramCopierRegistry,
      useFactory: (...copiers: ProgramCopier[]) => new ProgramCopierRegistry(...copiers),
      inject: [
        FormFieldsCopier,
        ParticipationCategoriesCopier,
        TimelinesCopier,
        RundownsCopier,
        FaqsCopier,
        PaymentsCopier,
        ProgramDetailsCopier,
        ContactCopier,
        LandingCopier,
        SpeakersCopier,
        TestimonialsCopier,
      ],
    },

    // Participation Info Handlers
    UpsertParticipationInfoHandler,
    DeleteParticipationInfoHandler,
    GetParticipationInfoHandler,
    ListParticipationInfoHandler,

    // Announcement Handlers
    ListProgramAnnouncementsHandler,
    GetProgramAnnouncementHandler,
    CreateProgramAnnouncementHandler,
    UpdateProgramAnnouncementHandler,
    DeleteProgramAnnouncementHandler,

    // LOA Batch Handlers
    CreateLoaBatchHandler,
    UpdateLoaBatchHandler,
    ReleaseLoaBatchHandler,
    UnreleaseLoaBatchHandler,
    DeleteLoaBatchHandler,
    GetLoaBatchesHandler,
    GetLoaDownloadsHandler,
    PreviewLoaTemplateHandler,
    LoaPreviewParticipantService,

    CacheService,
    LandingRevalidationService,
    LandingCacheInvalidationService,
    FormFieldKeyValidator,
    LoaReleaseBatchRepository,
    {
      provide: 'IProgramContentRepository',
      useClass: ProgramContentRepository,
    },
    {
      provide: 'IProgramRepository',
      useClass: ProgramRepository,
    },
    {
      provide: 'IScoringRubricRepository',
      useClass: ScoringRubricRepository,
    },
    // Scoring Rubric Handlers
    GetScoringRubricsHandler,
    GetScoringRubricVersionsHandler,
    UpsertScoringRubricHandler,
  ],
  exports: ['IProgramContentRepository', 'IProgramRepository', 'IScoringRubricRepository', ListProgramsHandler],
})
export class ProgramsModule { }
