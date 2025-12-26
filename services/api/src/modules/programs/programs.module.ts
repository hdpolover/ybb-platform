import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { ProgramsController } from './presentation/programs.controller';
import { ListProgramsHandler } from './application/queries/handlers/list-programs.handler';
import { GetProgramDetailHandler } from './application/queries/handlers/get-program-detail.handler';
import { UpdateProgramHandler } from './application/commands/handlers/update-program.handler';
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
import { ProgramContentRepository } from './infrastructure/persistence/program-content.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';

@Module({
  imports: [AuthModule],
  controllers: [ProgramsController],
  providers: [
    ListProgramsHandler,
    GetProgramDetailHandler,
    UpdateProgramHandler,
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
    PrismaService,
    CacheService,
    {
      provide: 'IProgramContentRepository',
      useClass: ProgramContentRepository,
    },
  ],
  exports: ['IProgramContentRepository'],
})
export class ProgramsModule { }
