import { Module } from '@nestjs/common';
import { ApplicationsController } from './presentation/applications.controller';

@Module({
  controllers: [ApplicationsController],
  providers: [],
})
export class ApplicationsModule {}
