import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { ProgramsController } from './presentation/programs.controller';
import { ListProgramsHandler } from './application/queries/handlers/list-programs.handler';
import { GetProgramDetailHandler } from './application/queries/handlers/get-program-detail.handler';
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
import { ProgramContentRepository } from './infrastructure/persistence/program-content.repository';
import { ProgramRepository } from './infrastructure/persistence/program.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';

@Module({
  imports: [CqrsModule, AuthModule, UsersModule],
  controllers: [ProgramsController],
  providers: [
    ListProgramsHandler,
    GetProgramDetailHandler,
    CreateProgramHandler,
    UpdateProgramHandler,
    DeleteProgramHandler,
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
