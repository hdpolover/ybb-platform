import { Controller, Post, UseInterceptors, UploadedFile, Body, Get, Param, Query, Logger, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../application/storage.service';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';

/**
 * REST Files Test Controller
 * No Guards, for benchmarking.
 */
@Controller('rest-files-test')
export class RestFilesTestController {
  private readonly logger = new Logger(RestFilesTestController.name);

  constructor(
    private readonly fileServiceClient: FileServiceClient,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body('user_id') userId: string,
    @Body('brand_id') brandId: string,
    @Body('bucket') bucket: string = 'documents',
    @Body('program_id') programId?: string,
    @Body('participant_id') participantId?: string,
  ) {
    if (!file) throw new BadRequestException('File required');
    try {
      this.logger.log(`[TEST] Uploading file via REST: ${file.originalname}`);
      
      const uploadResult = await this.storageService.uploadFile(
        file,
        userId,
        brandId,
        bucket,
        programId,
        'ybb',
        participantId
      );

      return {
        success: true,
        data: {
          file: uploadResult.fileInfo,
          url: uploadResult.url,
          path: uploadResult.path
        },
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw error;
    }
  }

  @Get(':fileId')
  async getFile(
    @Param('fileId') fileId: string,
    @Query('user_id') userId: string,
    @Query('brand_id') brandId: string,
  ) {
    return await this.fileServiceClient.getFile(fileId, userId, brandId);
  }
}
