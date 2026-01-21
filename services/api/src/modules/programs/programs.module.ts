import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { ProgramsController } from './presentation/programs.controller';
import { ProgramParticipationController } from './presentation/program-participation.controller';
import { ProgramLandingController } from './presentation/program-landing.controller';
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
  ListProgramRequirementsHandler,
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
  CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler
} from './application/commands/handlers/manage-program-content.handlers';
import {
  CreateApplicationFormFieldHandler,
  UpdateApplicationFormFieldHandler,
  DeleteApplicationFormFieldHandler,
} from './application/commands/handlers/application-form-field.handler';
import { GetApplicationFormFieldsHandler } from './application/queries/handlers/get-application-form-fields.handler';
import { GetParticipantProgressHandler } from './application/queries/handlers/get-participant-progress.handler';
import { ProgramContentRepository } from './infrastructure/persistence/program-content.repository';
import { ProgramRepository } from './infrastructure/persistence/program.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';

@Module({
  imports: [CqrsModule, AuthModule, UsersModule],
  controllers: [ProgramsController, ProgramParticipationController, ProgramLandingController],
  providers: [
    ListProgramsHandler,
    GetProgramDetailHandler,
    GetProgramLandingHandler,
    CreateProgramHandler,
    UpdateProgramHandler,
    DeleteProgramHandler,
    GetParticipantProgressHandler,
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
    ListProgramRequirementsHandler,
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
    CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
    // Form Field Handlers
    CreateApplicationFormFieldHandler,
    UpdateApplicationFormFieldHandler,
    DeleteApplicationFormFieldHandler,
    GetApplicationFormFieldsHandler,
    
    // Participation Info Handlers
    UpsertParticipationInfoHandler,
    DeleteParticipationInfoHandler,
    GetParticipationInfoHandler,
    ListParticipationInfoHandler,

    PrismaService,
    CacheService,
    {
      provide: 'IProgramContentRepository',
      useClass: ProgramContentRepository,
    },
    {
      provide: 'IProgramRepository',
      useClass: ProgramRepository,
    },
  ],
  exports: ['IProgramContentRepository', 'IProgramRepository'],
})
export class ProgramsModule { }
