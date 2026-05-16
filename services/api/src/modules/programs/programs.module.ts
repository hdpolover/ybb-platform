import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { FilesModule } from '@modules/files/files.module';
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
import { FormTemplatesController } from './presentation/form-templates.controller';
import { ProgramFormFieldsController } from './presentation/program-form-fields.controller';
import {
  CreateFormTemplateHandler,
  UpdateFormTemplateHandler,
  DeleteFormTemplateHandler,
} from './application/commands/handlers/form-template.handler';
import { ApplyFormTemplateHandler } from './application/commands/handlers/apply-form-template.handler';
import {
  GetFormTemplatesHandler,
  GetFormTemplateByIdHandler,
} from './application/queries/handlers/get-form-templates.handler';
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
  ListProgramRequirementsHandler,
  ListProgramEssaysHandler,
  ListProgramParticipationCategoriesHandler,
  ListProgramSubthemesHandler,
  ListDocumentTemplatesHandler,
} from './application/queries/handlers/list-program-content.handlers';
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
  GenerateLOAHandler,
  UpdateProgramPaymentInfoHandler,
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
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { FormFieldKeyValidator } from './application/validators/form-field-key.validator';

@Module({
  imports: [CqrsModule, AuthModule, UsersModule, FilesModule],
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
    FormTemplatesController,
    ProgramFormFieldsController,
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
    GenerateLOAHandler,
    UpdateProgramPaymentInfoHandler,
    // Form Field Handlers
    CreateApplicationFormFieldHandler,
    UpdateApplicationFormFieldHandler,
    DeleteApplicationFormFieldHandler,
    GetApplicationFormFieldsHandler,
    GetSystemFormFieldsHandler,
    CreateSystemFormFieldHandler,
    UpdateSystemFormFieldHandler,
    DeleteSystemFormFieldHandler,

    // Form Template Handlers
    CreateFormTemplateHandler,
    UpdateFormTemplateHandler,
    DeleteFormTemplateHandler,
    GetFormTemplatesHandler,
    GetFormTemplateByIdHandler,
    ApplyFormTemplateHandler,

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

    CacheService,
    FormFieldKeyValidator,
    {
      provide: 'IProgramContentRepository',
      useClass: ProgramContentRepository,
    },
    {
      provide: 'IProgramRepository',
      useClass: ProgramRepository,
    },
  ],
  exports: ['IProgramContentRepository', 'IProgramRepository', ListProgramsHandler],
})
export class ProgramsModule { }
