import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

export interface StorageUploadResult {
  url: string;
  path: string;
  fileInfo: any;
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
  private constructPublicUrl(fileData: any, defaultBucket: string): string {
    if (!fileData.storage_path) return '';
    
    // Whitelist for Public Image CDN
    // ONLY these folders typically contain safe-to-share images
    const PUBLIC_IMAGE_BUCKETS = ['gallery', 'programs', 'banners', 'sponsors', 'speakers', 'avatars', 'assets'];
    const bucket = fileData.bucket || defaultBucket;

    // 1. ImageKit Integration (Safe Mode)
    const imageKitId = this.configService.get<string>('IMAGEKIT_ID');
    const isImage = fileData.content_type && fileData.content_type.startsWith('image/');
    const isPublic = PUBLIC_IMAGE_BUCKETS.includes(bucket);

    if (imageKitId && isImage && isPublic) {
        // Remove leading slash
        const path = fileData.storage_path.startsWith('/') ? fileData.storage_path.substring(1) : fileData.storage_path;
        return `https://ik.imagekit.io/${imageKitId}/${path}`;
    }

    // 2. Custom Domain Logic (Existing)
    const isCustomDomain = this.storagePublicUrl && !this.storagePublicUrl.includes('digitaloceanspaces.com');
    
    const path = fileData.storage_path.startsWith('/') 
        ? fileData.storage_path.substring(1) 
        : fileData.storage_path;

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
    file: any,
    userId: string,
    brandId: string,
    folder: string, 
    programId?: string,
    targetBucket: string = 'ybb',
    participantId?: string
  ): Promise<StorageUploadResult> {
    this.logger.log(`Uploading file to folder ${folder} for program ${programId}`);

    // Try gRPC first
    try {
      this.logger.log('Attempting upload via gRPC...');
      const grpcResult = await this.fileGrpcClient.uploadFile(file.buffer, {
        filename: file.originalname,
        content_type: file.mimetype,
        user_id: userId,
        brand_id: brandId,
        bucket: folder,
        program_id: programId,
        participant_id: participantId,
      });

      this.logger.log('gRPC upload successful');
      
      // Map result to StorageUploadResult
      return {
        url: grpcResult.url,
        path: grpcResult.storage_path,
        fileInfo: {
            ...grpcResult,
            storage_path: grpcResult.storage_path,
            bucket: grpcResult.bucket || targetBucket
        }
      };
    } catch (grpcError) {
      this.logger.warn(`gRPC upload failed, falling back to REST: ${grpcError.message}`);
    }

    // Fallback to File Service REST
    // Note: The File Service Python currently accepts 'bucket' as the 4th argument.
    // Based on existing usage in GalleryService, we pass the folder name (e.g., 'gallery') here.
    const uploadResult = await this.fileService.uploadFile(
      file,
      userId,
      brandId,
      folder, 
      programId,
      participantId
    );

    if (!uploadResult || !uploadResult.file) {
      this.logger.error('File Service returned no file data');
      throw new InternalServerErrorException('Failed to upload file');
    }

    const fileData = uploadResult.file;
    const fullUrl = this.constructPublicUrl(fileData, targetBucket);

    return {
      url: fullUrl,
      path: fileData.storage_path,
      fileInfo: fileData
    };
  }
}
