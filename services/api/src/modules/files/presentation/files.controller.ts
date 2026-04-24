import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  Logger,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { StorageService } from '../application/storage.service';
import {
  CreateUploadUrlRequest,
  CreateUploadUrlResponse,
  FileResponse,
  FileServiceClient,
} from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';
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
    private readonly fileGrpcClient: FileGrpcClient,
    private readonly storageService: StorageService,
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
        program_id: {
          type: 'string',
        },
        participant_id: {
          type: 'string',
        },
      },
      required: ['file', 'user_id', 'brand_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('user_id') userId: string,
    @Body('brand_id') brandId: string,
    @Body('bucket') bucket: string = 'documents',
    @Body('program_id') programId?: string,
    @Body('participant_id') participantId?: string,
  ) {
    try {
      this.logger.log(
        `Uploading file: ${file.originalname} for user ${userId}, brand ${brandId}`,
      );
      
      const uploadResult = await this.storageService.uploadFile(
        file,
        userId,
        brandId,
        bucket,
        programId,
        'ybb',
        participantId
      );
      
      this.metricsService.fileUploadsTotal.inc({ file_type: bucket });

      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          file: uploadResult.fileInfo,
          url: uploadResult.url,
          path: uploadResult.path
        },
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
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
      
      let result: FileResponse;
      // Try gRPC first
      try {
         result = (await this.fileGrpcClient.getFile(fileId, userId, brandId)) as unknown as FileResponse;
      } catch (grpcError: unknown) {
         this.logger.warn(`gRPC getFile failed, falling back to REST: ${grpcError instanceof Error ? grpcError.message : String(grpcError)}`);
         result = await this.fileServiceClient.getFile(fileId, userId, brandId);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to get file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  @Get(':fileId/download')
  @ApiOperation({ summary: 'Proxy-redirect to file CDN URL — masks the raw CDN path from clients' })
  @ApiResponse({ status: 302, description: 'Redirects to CDN URL' })
  async downloadFile(
    @Param('fileId') fileId: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`Download redirect: ${fileId} (user ${user.userId})`);
    let file: FileResponse;
    try {
      file = (await this.fileGrpcClient.getFile(fileId, user.userId, user.brandId)) as unknown as FileResponse;
    } catch {
      file = await this.fileServiceClient.getFile(fileId, user.userId, user.brandId);
    }
    const url = (file.public_url ?? file.url ?? file.cdn_url) as string | undefined;
    if (!url) throw new NotFoundException('File URL not available');
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  }

  @Post('upload-url')
  @ApiOperation({
    summary:
      'Presigned PUT URL (REST flow) — validates + reserves a PROCESSING file row, returns URL the client PUTs to directly',
  })
  @ApiResponse({ status: 201, description: 'Upload URL issued' })
  async requestUploadUrl(
    @Body() dto: CreateUploadUrlRequest,
  ): Promise<CreateUploadUrlResponse> {
    // Return raw data; the global TransformInterceptor wraps it as
    // `{ statusCode, message, data }`. Wrapping here would double-envelope.
    this.logger.log(`Requesting upload URL for ${dto.filename} (brand ${dto.brand_id})`);
    const data = await this.fileServiceClient.createUploadUrl(dto);
    this.metricsService.fileUploadsTotal.inc({ file_type: dto.bucket ?? 'documents' });
    return data;
  }

  @Patch(':fileId/ready')
  @ApiOperation({
    summary:
      'Mark a file as READY after the client PUT to the presigned URL succeeded (idempotent)',
  })
  @ApiResponse({ status: 200, description: 'File transitioned to READY (or already was)' })
  async markFileReady(
    @Param('fileId') fileId: string,
    @Query('brand_id') brandId: string,
    @Query('actual_size') actualSize?: string,
  ): Promise<FileResponse> {
    this.logger.log(`Marking file ready: ${fileId} (brand ${brandId})`);
    const parsed = actualSize ? Number(actualSize) : NaN;
    const size = !isNaN(parsed) ? parsed : undefined;
    return this.fileServiceClient.markFileReady(fileId, brandId, size);
  }

  @Post('presigned-upload-url')
  @ApiOperation({ summary: 'Get presigned URL for direct upload' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async getPresignedUploadUrl(
    @Body() dto: {
      filename: string;
      content_type: string;
      user_id: string;
      brand_id: string;
      bucket?: string;
      program_id?: string;
      participant_id?: string;
      size?: number;
    }
  ) {
    try {
      this.logger.log(`Generating presigned upload URL for: ${dto.filename}`);
      
      const result = await this.fileGrpcClient.getPresignedUploadUrl({
          filename: dto.filename,
          content_type: dto.content_type,
          user_id: dto.user_id,
          brand_id: dto.brand_id,
          bucket: dto.bucket || 'uploads',
          program_id: dto.program_id,
          participant_id: dto.participant_id,
          size: dto.size
      });

      return {
        success: true,
        data: result
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to generate presigned upload URL: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
