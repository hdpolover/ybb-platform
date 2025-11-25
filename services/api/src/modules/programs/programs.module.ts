import { Module } from '@nestjs/common';
import { ProgramsController } from './presentation/programs.controller';

@Module({
  controllers: [ProgramsController],
  providers: [],
})
export class ProgramsModule {}
