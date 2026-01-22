import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';

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
    private readonly configService: ConfigService,
  ) {
    this.storagePublicUrl = this.configService.get<string>('STORAGE_PUBLIC_URL', '');
  }

  /**
   * Upload a file and return its public URL
   * @param file The file object from Multer
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

    // Upload to File Service
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

  private constructPublicUrl(fileData: any, defaultBucket: string): string {
    if (!fileData.storage_path) return '';

    // Logic to construct the public URL
    // Check if we are using a custom domain (e.g. files.ybbhub.com)
    // Heuristic: If STORAGE_PUBLIC_URL does NOT contain "digitaloceanspaces.com", assume it's custom domain for the bucket.
    const isCustomDomain = this.storagePublicUrl && !this.storagePublicUrl.includes('digitaloceanspaces.com');
    
    // Ensure path doesn't have leading slash for concatenation
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

    // Default DO/S3 logic: assume bucket.region/path
    // We assume STORAGE_PUBLIC_URL is something like "https://sgp1.digitaloceanspaces.com"
    const regionUrl = this.storagePublicUrl.replace('https://', '').replace(/\/$/, '');
    
    // Use bucket from response if available, else default
    const bucket = fileData.bucket || defaultBucket;
    
    // Final URL format: https://{bucket}.{region}/{path}
    return `https://${bucket}.${regionUrl}/${path}`;
  }
}
