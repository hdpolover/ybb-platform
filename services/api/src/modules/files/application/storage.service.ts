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
    targetBucket: string = 'ybb'
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
      programId
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
    // We assume STORAGE_PUBLIC_URL is something like "https://sgp1.digitaloceanspaces.com"
    const regionUrl = this.storagePublicUrl.replace('https://', '');
    
    // Ensure path doesn't have leading slash for concatenation
    const path = fileData.storage_path.startsWith('/') 
        ? fileData.storage_path.substring(1) 
        : fileData.storage_path;
        
    // Use bucket from response if available, else default
    const bucket = fileData.bucket || defaultBucket;
    
    // Final URL format: https://{bucket}.{region}/{path}
    return `https://${bucket}.${regionUrl}/${path}`;
  }
}
