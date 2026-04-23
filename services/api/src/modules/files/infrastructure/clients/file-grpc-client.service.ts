import { Inject, Injectable, OnModuleInit, InternalServerErrorException, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, ReplaySubject, toArray } from 'rxjs';
import {
  FileService,
  UploadFileRequest,
  FileMetadata,
  GenerateCertificateRequest,
  GenerateReceiptRequest,
  GetPresignedUploadUrlRequest,
  ConfirmUploadRequest
} from './file.interface';
import { Readable } from 'stream';

const TRANSIENT_CODES = new Set([14]); // UNAVAILABLE
function isTransientGrpcError(err: any): boolean {
  return TRANSIENT_CODES.has(err?.code) ||
    /UNAVAILABLE|Connection dropped|No connection established|ECONNREFUSED/i.test(err?.message ?? '');
}

async function withGrpcRetry<T>(fn: () => Promise<T>, logger: Logger, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isTransientGrpcError(err) && attempt < retries) {
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        logger.warn(`gRPC transient error (attempt ${attempt + 1}/${retries}), retry in ${delay}ms: ${(err as any).message}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

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
      return await withGrpcRetry(async () => {
        const subject = new ReplaySubject<UploadFileRequest>();

        if (!metadata.size) {
          metadata.size = fileBuffer.length;
        }

        subject.next({ metadata });

        const chunkSize = 64 * 1024;
        for (let i = 0; i < fileBuffer.length; i += chunkSize) {
          subject.next({ chunk_data: fileBuffer.slice(i, i + chunkSize) });
        }

        subject.complete();

        return await lastValueFrom(this.fileService.UploadFile(subject.asObservable()));
      }, this.logger);
    } catch (error) {
      this.logger.error(`gRPC upload failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async getFile(fileId: string, userId: string, brandId: string) {
    try {
      return await withGrpcRetry(
        () => lastValueFrom(this.fileService.GetFile({ file_id: fileId, user_id: userId, brand_id: brandId })),
        this.logger,
      );
    } catch (error) {
      this.logger.error(`gRPC get file failed: ${error.message}`);
      throw error;
    }
  }

  async downloadFile(fileId: string, userId: string, brandId: string): Promise<Buffer> {
    try {
      const chunks = await withGrpcRetry(
        () => lastValueFrom(this.fileService.DownloadFile({ file_id: fileId, user_id: userId, brand_id: brandId }).pipe(toArray())),
        this.logger,
      );
      return Buffer.concat(chunks.map(c => c.chunk_data));
    } catch (error) {
      this.logger.error(`gRPC download failed: ${error.message}`);
      throw error;
    }
  }

  async generateCertificate(request: GenerateCertificateRequest) {
    try {
      return await withGrpcRetry(
        () => lastValueFrom(this.fileService.GenerateCertificate(request)),
        this.logger,
      );
    } catch (error) {
      this.logger.error(`gRPC generate certificate failed: ${error.message}`);
      throw error;
    }
  }

  async generateReceipt(request: GenerateReceiptRequest) {
    try {
      return await withGrpcRetry(
        () => lastValueFrom(this.fileService.GenerateReceipt(request)),
        this.logger,
      );
    } catch (error) {
      this.logger.error(`gRPC generate receipt failed: ${error.message}`);
      throw error;
    }
  }

  async getPresignedUploadUrl(request: GetPresignedUploadUrlRequest) {
    try {
      return await withGrpcRetry(
        () => lastValueFrom(this.fileService.GetPresignedUploadUrl(request)),
        this.logger,
      );
    } catch (error) {
      this.logger.error(`gRPC get presigned url failed: ${error.message}`);
      throw error;
    }
  }

  async confirmUpload(request: ConfirmUploadRequest) {
    try {
      return await withGrpcRetry(
        () => lastValueFrom(this.fileService.ConfirmUpload(request)),
        this.logger,
      );
    } catch (error) {
      this.logger.error(`gRPC confirm upload failed: ${error.message}`);
      throw error;
    }
  }
}
