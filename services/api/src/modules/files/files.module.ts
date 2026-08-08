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
import { AdminMediaController } from './presentation/admin-media.controller';
import { FileServiceClient } from './infrastructure/clients/file-service.client';
import { FileGrpcClient } from './infrastructure/clients/file-grpc-client.service';
import { StorageService } from './application/storage.service';
import { PrivateFileUrlResolver } from './application/private-file-url-resolver.service';

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
            protoPath: join(process.cwd(), 'dist/protos/file_service.proto'),
            url: configService.get('FILE_GRPC_URL') || 'host.docker.internal:50052',
            loader: {
              keepCase: true,
            },
            channelOptions: {
              // Be conservative with pings to avoid server ENHANCE_YOUR_CALM rejections.
              'grpc.keepalive_time_ms': 60000,
              'grpc.keepalive_timeout_ms': 5000,
              'grpc.keepalive_permit_without_calls': 0,
              'grpc.http2.max_pings_without_data': 2,
              // Reconnect fast: start at 1s, cap at 5s (default max is 120s)
              'grpc.initial_reconnect_backoff_ms': 1000,
              'grpc.min_reconnect_backoff_ms': 1000,
              'grpc.max_reconnect_backoff_ms': 5000,
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
  controllers: [FilesController, DocumentsController, StorageEventsController, AdminMediaController],
  providers: [FileServiceClient, FileGrpcClient, StorageService, PrivateFileUrlResolver],
  exports: [FileServiceClient, FileGrpcClient, StorageService, PrivateFileUrlResolver],
})
export class FilesModule { }
