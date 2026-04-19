import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

export interface StorageUploadResult {
  url: string;
  path: string;
  fileInfo: Record<string, unknown>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storagePublicUrl: string;

  constructor(
    private readonly fileService: FileServiceClient,
    private readonly fileGrpcClient: FileGrpcClient,
    private readonly configService: ConfigService,
  ) {
    this.storagePublicUrl = this.configService.get<string>('STORAGE_PUBLIC_URL', '');
  }

  /**
   * Generates a URL for the file. 
   * Integrating ImageKit or similar CDNs here is efficient.
   */
  private constructPublicUrl(fileData: Record<string, unknown>, defaultBucket: string): string {
    if (!fileData.storage_path) return '';
    
    const storagePath = fileData.storage_path as string;
    const contentType = fileData.content_type as string | undefined;
    const bucket = (fileData.bucket as string) || defaultBucket;

    // Whitelist for Public Image CDN
    // ONLY these folders typically contain safe-to-share images
    const PUBLIC_IMAGE_BUCKETS = ['gallery', 'programs', 'banners', 'sponsors', 'speakers', 'avatars', 'assets', 'brands', 'brands/logos', 'brands/banners', 'payment-methods'];

    // 1. ImageKit Integration (Safe Mode)
    const imageKitId = this.configService.get<string>('IMAGEKIT_ID');
    const isImage = contentType && contentType.startsWith('image/');
    const isPublic = PUBLIC_IMAGE_BUCKETS.includes(bucket);

    if (imageKitId && isImage && isPublic) {
        // Remove leading slash
        const path = storagePath.startsWith('/') ? storagePath.substring(1) : storagePath;
        return `https://ik.imagekit.io/${imageKitId}/${path}`;
    }

    // 2. Custom Domain Logic (Existing)
    const isCustomDomain = this.storagePublicUrl && !this.storagePublicUrl.includes('digitaloceanspaces.com');
    
    const path = storagePath.startsWith('/') 
        ? storagePath.substring(1) 
        : storagePath;

    if (isCustomDomain) {
        // Assume STORAGE_PUBLIC_URL points to the bucket root
        let baseUrl = this.storagePublicUrl;
        if (!baseUrl.startsWith('http')) {
             baseUrl = `https://${baseUrl}`;
        }
        // Remove trailing slash
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }
        return `${baseUrl}/${path}`;
    }

    // 3. Default DO/S3 logic: assume bucket.region/path
    // We assume STORAGE_PUBLIC_URL is something like "https://sgp1.digitaloceanspaces.com"
    const regionUrl = this.storagePublicUrl.replace('https://', '').replace(/\/$/, '');
    
    // Final URL format: https://{bucket}.{region}/{path}
    return `https://${bucket}.${regionUrl}/${path}`;
  }

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
