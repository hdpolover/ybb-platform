import { Module } from '@nestjs/common';
import { ProgramsController } from './presentation/programs.controller';
import { ListProgramsHandler } from './application/queries/handlers/list-programs.handler';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [ProgramsController],
  providers: [ListProgramsHandler, PrismaService],
})
export class ProgramsModule {}
