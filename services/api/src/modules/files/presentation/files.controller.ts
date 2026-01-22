import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { FileServiceClient, FileResponse } from '../infrastructure/clients/file-service.client';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

/**
 * Files Controller
 * 
 * Presentation Layer - REST API
 * Handles file upload/download requests and proxies them to the File Service
 */
@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly fileServiceClient: FileServiceClient,
    private readonly metricsService: MetricsService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload file to storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        user_id: {
          type: 'string',
        },
        brand_id: {
          type: 'string',
        },
        bucket: {
          type: 'string',
          default: 'documents',
        },
      },
      required: ['file', 'user_id', 'brand_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body('user_id') userId: string,
    @Body('brand_id') brandId: string,
    @Body('bucket') bucket: string = 'documents',
  ) {
    try {
      this.logger.log(
        `Uploading file: ${file.originalname} for user ${userId}, brand ${brandId}`,
      );
      
      const result = await this.fileServiceClient.uploadFile(
        file,
        userId,
        brandId,
        bucket,
      );
      
      this.metricsService.fileUploadsTotal.inc({ file_type: bucket });

      return {
        success: true,
        message: 'File uploaded successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw error;
    }
  }

  @Get(':fileId')
  @ApiOperation({ summary: 'Get file information and download URL' })
  @ApiResponse({ status: 200, description: 'File information retrieved successfully' })
  async getFile(
    @Param('fileId') fileId: string,
    @Query('user_id') userId: string,
    @Query('brand_id') brandId: string,
  ): Promise<{ success: boolean; data: FileResponse }> {
    try {
      this.logger.log(`Retrieving file: ${fileId} for user ${userId}, brand ${brandId}`);
      
      const result = await this.fileServiceClient.getFile(fileId, userId, brandId);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to get file: ${error.message}`);
      throw error;
    }
  }

  @Get('health/check')
  @ApiOperation({ summary: 'Health check for files service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      service: 'files',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
