import { Inject, Injectable, OnModuleInit, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { lastValueFrom, ReplaySubject, toArray } from 'rxjs';
import {
  FileService,
  UploadFileRequest,
  FileMetadata,
  GenerateCertificateRequest,
  GenerateReceiptRequest,
  GetPresignedUploadUrlRequest,
  ConfirmUploadRequest,
  GetPresignedUrlInternalResponse
} from './file.interface';
import { Readable } from 'stream';

const TRANSIENT_CODES = new Set([14]); // UNAVAILABLE
function isTransientGrpcError(err: any): boolean {
  return TRANSIENT_CODES.has(err?.code) ||
    /UNAVAILABLE|Connection dropped|No connection established|ECONNREFUSED/i.test(err?.message ?? '');
}

// The Python file service raises domain validation exceptions (bad file type,
// file too large, filename too long — see file/app/domain/exceptions/file_exceptions.py)
// with these exact message shapes. Its gRPC UploadFile handler currently wraps
// *every* exception, including these, into a single grpc.StatusCode.INTERNAL
// abort (grpc_main.py's outer except-all), so `error.code` alone can't yet
// distinguish "the photo is 15MB" from "the DB is down". Match on the known
// message shapes so the specific, actionable reason still reaches the
// participant instead of a generic 500. `error.code === INVALID_ARGUMENT` is
// checked too so this keeps working once grpc_main.py is fixed to abort with
// the correct status for these exceptions (see followUps).
const DOMAIN_VALIDATION_MESSAGE_PATTERNS = [
  /not allowed\. Allowed types:/i,
  /bytes exceeds limit of/i,
  /exceeds maximum of \d+ characters/i,
];

function isDomainValidationError(err: any): boolean {
  if (err?.code === GrpcStatus.INVALID_ARGUMENT) return true;
  const message: string = err?.details ?? err?.message ?? '';
  return DOMAIN_VALIDATION_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function grpcErrorMessage(err: any): string {
  return err?.details || err?.message || 'Upload failed. Please try again.';
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
      if (isDomainValidationError(error)) {
        throw new BadRequestException(grpcErrorMessage(error));
      }
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

  async getPresignedUrlInternal(
    storagePath: string,
    expirySeconds?: number,
  ): Promise<GetPresignedUrlInternalResponse> {
    try {
      return await withGrpcRetry(
        () =>
          lastValueFrom(
            this.fileService.GetPresignedUrlInternal({
              storage_path: storagePath,
              expiry_seconds: expirySeconds ?? 0,
            }),
          ),
        this.logger,
      );
    } catch (error) {
      this.logger.error(`gRPC get presigned url internal failed: ${error.message}`);
      throw error;
    }
  }
}
