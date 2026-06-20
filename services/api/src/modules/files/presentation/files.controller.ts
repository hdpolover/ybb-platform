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
import { Public } from '@shared/decorators/public.decorator';
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
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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
  private static readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly fileServiceClient: FileServiceClient,
    private readonly fileGrpcClient: FileGrpcClient,
    private readonly storageService: StorageService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  private isSelfDownloadProxyUrl(url: string, fileId: string): boolean {
    const escapedId = fileId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`/v1/files/${escapedId}/download(?:\\?|#|$)`, 'i').test(url);
  }

  private extractCandidateUrl(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const directUrl = record.url;
    if (typeof directUrl === 'string' && directUrl.length > 0) {
      return directUrl;
    }

    const publicUrl = record.public_url;
    if (typeof publicUrl === 'string' && publicUrl.length > 0) {
      return publicUrl;
    }

    const data = record.data;
    if (data && typeof data === 'object') {
      const nestedUrl = (data as Record<string, unknown>).url;
      if (typeof nestedUrl === 'string' && nestedUrl.length > 0) {
        return nestedUrl;
      }
      const nestedPublicUrl = (data as Record<string, unknown>).public_url;
      if (typeof nestedPublicUrl === 'string' && nestedPublicUrl.length > 0) {
        return nestedPublicUrl;
      }
    }

    return null;
  }

  private async resolveDownloadUrlViaFileService(fileId: string, brandId: string): Promise<string | null> {
    try {
      const grpcResult = await this.fileGrpcClient.getFile(fileId, brandId, brandId);
      const grpcUrl = this.extractCandidateUrl(grpcResult);
      if (grpcUrl && !this.isSelfDownloadProxyUrl(grpcUrl, fileId)) {
        return grpcUrl;
      }
    } catch (error: unknown) {
      this.logger.warn(
        `gRPC public-url fallback failed for file ${fileId} / brand ${brandId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      const restResult = await this.fileServiceClient.getFile(fileId, brandId, brandId);
      const restUrl = this.extractCandidateUrl(restResult);
      if (restUrl && !this.isSelfDownloadProxyUrl(restUrl, fileId)) {
        return restUrl;
      }
    } catch (error: unknown) {
      this.logger.warn(
        `REST public-url fallback failed for file ${fileId} / brand ${brandId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return null;
  }

  private async resolvePublicDownloadUrl(fileId: string): Promise<string | null> {
    const normalizedFileId = fileId.trim().toLowerCase();
    if (!FilesController.UUID_PATTERN.test(normalizedFileId)) {
      return null;
    }

    const file = await this.prisma.file.findFirst({
      where: { id: normalizedFileId },
      select: { url: true },
    });
    if (file?.url) {
      return file.url;
    }

    // Legacy and third-party URLs may embed a UUID filename that differs from
    // the files.id value. Resolve those by storage path before checking content
    // tables to keep masked links backward-compatible.
    const fileByStoragePath = await this.prisma.file.findFirst({
      where: {
        OR: [
          {
            storagePath: {
              contains: normalizedFileId,
              mode: 'insensitive',
            },
          },
          {
            url: {
              contains: normalizedFileId,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { url: true },
    });
    if (fileByStoragePath?.url && !this.isSelfDownloadProxyUrl(fileByStoragePath.url, normalizedFileId)) {
      return fileByStoragePath.url;
    }

    const suffix = `${normalizedFileId}.`;
    const resourceCandidates = await this.prisma.programResource.findMany({
      where: {
        isActive: true,
        OR: [
          {
            fileUrl: {
              contains: suffix,
              mode: 'insensitive',
            },
          },
          {
            fileUrl: {
              contains: normalizedFileId,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        fileUrl: true,
        program: {
          select: {
            brandId: true,
          },
        },
      },
      take: 10,
    });
    const resourceUrl =
      resourceCandidates
        .map((candidate) => candidate.fileUrl)
        .filter((url): url is string => url !== null)
        .find((url) => !this.isSelfDownloadProxyUrl(url, normalizedFileId)) ?? null;
    if (resourceUrl) {
      return resourceUrl;
    }

    for (const candidate of resourceCandidates) {
      const candidateBrandId = candidate.program?.brandId;
      if (!candidateBrandId) {
        continue;
      }

      const resolved = await this.resolveDownloadUrlViaFileService(normalizedFileId, candidateBrandId);
      if (resolved) {
        return resolved;
      }
    }

    const templateCandidates = await this.prisma.documentTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          {
            templateUrl: {
              contains: suffix,
              mode: 'insensitive',
            },
          },
          {
            templateUrl: {
              contains: normalizedFileId,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { templateUrl: true },
      take: 10,
    });
    const templateUrl =
      templateCandidates
        .map((candidate) => candidate.templateUrl)
        .find(
          (url): url is string =>
            typeof url === 'string' && url.length > 0 && !this.isSelfDownloadProxyUrl(url, normalizedFileId),
        ) ?? null;

    return templateUrl;
  }

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
    @CurrentUser() user: CurrentUserData,
    @Body('bucket') bucket: string = 'documents',
    @Body('program_id') programId?: string,
    @Body('participant_id') participantId?: string,
  ) {
    try {
      const userId = user.userId;
      const brandId = user.brandId;
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
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ success: boolean; data: FileResponse }> {
    try {
      const userId = user.userId;
      const brandId = user.brandId;
      this.logger.log(`Retrieving file: ${fileId} for user ${userId}, brand ${brandId}`);

      // SECURITY: ownership is not verifiable in this API layer because FileResponse
      // does not include owner fields. The caller's userId and brandId are forwarded
      // to the file service on every request; the file service MUST enforce that
      // the requested file's owner matches the caller (userId or brandId) and return
      // a 403/404 if not. No additional check is possible here without changing the
      // file service's response contract.
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

  @Public()
  @Get(':fileId/download')
  @ApiOperation({ summary: 'Public proxy-redirect to file URL for masked links opened in browser tabs' })
  @ApiResponse({ status: 302, description: 'Redirects to CDN URL' })
  async downloadFile(
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`Public download redirect: ${fileId}`);
    const url = await this.resolvePublicDownloadUrl(fileId);
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
    @CurrentUser() user: CurrentUserData,
  ): Promise<CreateUploadUrlResponse> {
    // Return raw data; the global TransformInterceptor wraps it as
    // `{ statusCode, message, data }`. Wrapping here would double-envelope.
    const scopedRequest: CreateUploadUrlRequest = {
      ...dto,
      user_id: user.userId,
      brand_id: user.brandId,
    };
    this.logger.log(`Requesting upload URL for ${scopedRequest.filename} (brand ${scopedRequest.brand_id})`);
    const data = await this.fileServiceClient.createUploadUrl(scopedRequest);
    this.metricsService.fileUploadsTotal.inc({ file_type: scopedRequest.bucket ?? 'documents' });
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
    @CurrentUser() user: CurrentUserData,
    @Query('actual_size') actualSize?: string,
  ): Promise<FileResponse> {
    this.logger.log(`Marking file ready: ${fileId} (brand ${user.brandId}, user ${user.userId})`);
    const parsed = actualSize ? Number(actualSize) : NaN;
    const size = !isNaN(parsed) ? parsed : undefined;
    // SECURITY: ownership is not verifiable in this API layer because the file service
    // does not return owner fields in its response. The caller's userId and brandId are
    // forwarded to the file service; the file service MUST verify that the file was
    // originally created by this caller before transitioning to READY.
    return this.fileServiceClient.markFileReady(fileId, user.userId, user.brandId, size);
  }

  @Post('presigned-upload-url')
  @ApiOperation({ summary: 'Get presigned URL for direct upload' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async getPresignedUploadUrl(
    @Body() dto: {
      filename: string;
      content_type: string;
      user_id?: string;
      brand_id?: string;
      bucket?: string;
      program_id?: string;
      participant_id?: string;
      size?: number;
    },
    @CurrentUser() user: CurrentUserData,
  ) {
    try {
      this.logger.log(`Generating presigned upload URL for: ${dto.filename} (user ${user.userId}, brand ${user.brandId})`);

      const result = await this.fileGrpcClient.getPresignedUploadUrl({
          filename: dto.filename,
          content_type: dto.content_type,
          // Always use JWT-sourced identity — never trust caller-supplied user_id/brand_id.
          user_id: user.userId,
          brand_id: user.brandId,
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
