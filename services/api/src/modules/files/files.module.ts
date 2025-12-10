import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { FilesController } from './presentation/files.controller';
import { DocumentsController } from './presentation/documents.controller';
import { FileServiceClient } from './infrastructure/clients/file-service.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds for file operations
      maxRedirects: 5,
    }),
    ConfigModule,
    AuthModule,
  ],
  controllers: [FilesController, DocumentsController],
  providers: [FileServiceClient],
  exports: [FileServiceClient],
})
export class FilesModule { }
