import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

export interface StorageUploadResult {
  url: string;
  path: string;
  fileInfo: Record<string, unknown>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly fileGrpcClient: FileGrpcClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * @param userId The ID of the user uploading the file
   * @param brandId The Brand ID (Program Category ID)
   * @param folder The folder/category on the storage (mapped to 'bucket' param in FileService)
   * @param programId Optional Program ID for context
   * @param targetBucket The actual S3/Spaces bucket name (default: ybb)
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    brandId: string,
    folder: string, 
    programId?: string,
    targetBucket: string = 'ybb',
    participantId?: string
  ): Promise<StorageUploadResult> {
    this.logger.log(`Uploading file to folder ${folder} for program ${programId}`);

    this.logger.log('Uploading via gRPC...');
    const grpcResult = await this.fileGrpcClient.uploadFile(file.buffer, {
      filename: file.originalname,
      content_type: file.mimetype,
      user_id: userId,
      brand_id: brandId,
      bucket: folder,
      program_id: programId,
      participant_id: participantId,
      size: file.size,
    });

    this.logger.log('gRPC upload successful');

    return {
      url: grpcResult.url,
      path: grpcResult.storage_path,
      fileInfo: {
        ...grpcResult,
        storage_path: grpcResult.storage_path,
        bucket: grpcResult.bucket || targetBucket,
      },
    };
  }
}
