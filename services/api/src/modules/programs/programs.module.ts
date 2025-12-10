import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { ProgramsController } from './presentation/programs.controller';
import { ListProgramsHandler } from './application/queries/handlers/list-programs.handler';
import { GetProgramDetailHandler } from './application/queries/handlers/get-program-detail.handler';
import { UpdateProgramHandler } from './application/commands/handlers/update-program.handler';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';

@Module({
  imports: [AuthModule],
  controllers: [ProgramsController],
  providers: [
    ListProgramsHandler,
    GetProgramDetailHandler,
    UpdateProgramHandler,
    PrismaService,
    CacheService,
  ],
})
export class ProgramsModule { }
