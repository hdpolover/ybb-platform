import { Inject, Injectable, OnModuleInit, InternalServerErrorException, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, ReplaySubject, toArray } from 'rxjs';
import { FileService, UploadFileRequest, FileMetadata } from './file.interface';
import { Readable } from 'stream';

@Injectable()
export class FileGrpcClient implements OnModuleInit {
  private fileService: FileService;
  private readonly logger = new Logger(FileGrpcClient.name);

  constructor(@Inject('FILE_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.fileService = this.client.getService<FileService>('FileService');
  }

  async uploadFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
  ) {
    try {
      const subject = new ReplaySubject<UploadFileRequest>();

      // 1. Send Metadata Packet First
      subject.next({ metadata });

      // 2. Chunk buffer and send data packets
      const chunkSize = 64 * 1024; // 64KB chunks
      for (let i = 0; i < fileBuffer.length; i += chunkSize) {
        const chunk = fileBuffer.slice(i, i + chunkSize);
        subject.next({ chunk_data: chunk });
      }

      subject.complete();

      // Convert observable directly to promise
      return await lastValueFrom(this.fileService.UploadFile(subject.asObservable()));
    } catch (error) {
      this.logger.error(`gRPC upload failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async getFile(fileId: string, userId: string, brandId: string) {
    try {
      return await lastValueFrom(this.fileService.GetFile({
        file_id: fileId,
        user_id: userId,
        brand_id: brandId,
      }));
    } catch (error) {
      this.logger.error(`gRPC get file failed: ${error.message}`);
      throw error;
    }
  }

  async downloadFile(fileId: string, userId: string, brandId: string): Promise<Buffer> {
    try {
      const chunks = await lastValueFrom(
        this.fileService.DownloadFile({
          file_id: fileId,
          user_id: userId,
          brand_id: brandId,
        }).pipe(toArray())
      );
      
      const bufferChunks = chunks.map(c => c.chunk_data);
      return Buffer.concat(bufferChunks);
    } catch (error) {
      this.logger.error(`gRPC download failed: ${error.message}`);
      throw error;
    }
  }
}
