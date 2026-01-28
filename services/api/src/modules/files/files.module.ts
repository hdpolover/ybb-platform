import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AuthModule } from '@modules/auth/auth.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';
import { FilesController } from './presentation/files.controller';
import { DocumentsController } from './presentation/documents.controller';
import { StorageEventsController } from './presentation/storage-events.controller';
import { FileServiceClient } from './infrastructure/clients/file-service.client';
import { FileGrpcClient } from './infrastructure/clients/file-grpc-client.service';
import { StorageService } from './application/storage.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds for file operations
      maxRedirects: 5,
    }),
    ClientsModule.registerAsync([
      {
        name: 'FILE_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'file',
            protoPath: join(__dirname, '../../protos/file_service.proto'),
            url: configService.get('FILE_GRPC_URL') || 'host.docker.internal:50052',
            loader: {
              keepCase: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    ConfigModule,
    AuthModule,
    MonitoringModule,
  ],
  controllers: [FilesController, DocumentsController, StorageEventsController],
  providers: [FileServiceClient, FileGrpcClient, StorageService],
  exports: [FileServiceClient, FileGrpcClient, StorageService],
})
export class FilesModule { }

