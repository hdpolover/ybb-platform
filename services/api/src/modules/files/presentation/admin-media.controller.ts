import {
  BadRequestException,
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Post,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { resolveRevenueAccessScope, assertProgramAccess } from '@modules/stats/revenue/utils/revenue-access.util';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { StorageService } from '../application/storage.service';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '../application/private-file-url-resolver.service';
import { isPrivateCategoryKey } from '@shared/utils/private-file-key';

/**
 * Admin Media Library Controller
 *
 * Exposes program-scoped media management for program admins:
 *   GET    /admin/programs/:programId/media       — list assets (paginated)
 *   POST   /admin/programs/:programId/media       — upload new asset
 *   DELETE /admin/programs/:programId/media/:fileId — delete asset
 */
@ApiTags('admin/media')
@Controller('admin/programs/:programId/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminMediaController {
  private readonly logger = new Logger(AdminMediaController.name);

  constructor(
    private readonly fileServiceClient: FileServiceClient,
    private readonly storageService: StorageService,
    private readonly privateFileUrlResolver: PrivateFileUrlResolver,
    private readonly prismaRead: PrismaReadService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List program media assets (media library)' })
  @ApiParam({ name: 'programId', description: 'Program UUID' })
  @ApiQuery({ name: 'asset_type', required: false, description: 'Filter: image | document | logo | banner | gallery | certificate | other' })
  @ApiQuery({ name: 'bucket', required: false, description: 'Filter by storage bucket/category' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of media files' })
  async listMedia(
    @Param('programId') programId: string,
    @CurrentUser() user: CurrentUserData,
    @Query('asset_type') assetType?: string,
    @Query('bucket') bucket?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    // Return the raw paginated payload; the global TransformInterceptor adds
    // the `{ statusCode, message, data }` envelope. Wrapping here would
    // double-envelope and break the admin-dashboard's `listProgramMedia`.
    this.logger.log(`Listing media for program ${programId}`);
    try {
      // brand_id is derived server-side from the program and authorized against the
      // caller's admin access scope — never taken off the query string. A caller-
      // supplied brand_id was previously trusted as-is, letting any authenticated
      // admin read another brand's media by pairing a foreign programId with a
      // foreign brand_id. Reuses the same admin scope classifier the revenue
      // endpoints use (resolveRevenueAccessScope/assertProgramAccess).
      const scope = await resolveRevenueAccessScope(this.prismaRead, user);
      const program = await assertProgramAccess(this.prismaRead, scope, programId);

      const result = await this.fileServiceClient.listProgramMedia({
        programId,
        brandId: program.brandId,
        assetType,
        bucket,
        page: Number(page),
        limit: Number(limit),
      });
      return await this.presignPrivateMediaFiles(result);
    } catch (error: unknown) {
      this.logger.error(`Failed to list media for program ${programId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * For files whose storage key is a private category (documents, signed-copies),
   * replace url/download_url with a fresh presigned url. Fail closed: if presigning
   * fails, both fields are cleared rather than left pointing at a stored url.
   * Non-private files are left untouched.
   */
  private async presignPrivateMediaFiles(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const files = payload?.files;
    if (!Array.isArray(files)) return payload;

    const resolvedFiles = await Promise.all(
      files.map(async (file: Record<string, unknown>) => {
        const storagePath = file?.storage_path;
        if (typeof storagePath !== 'string' || !isPrivateCategoryKey(storagePath)) {
          return file;
        }

        const resolution = await this.privateFileUrlResolver.resolveByKey(storagePath);
        const presignedUrl = resolution === PRIVATE_FILE_UNAVAILABLE || resolution === null ? null : resolution;
        return { ...file, url: presignedUrl, download_url: presignedUrl };
      }),
    );

    return { ...payload, files: resolvedFiles };
  }

  @Post()
  @ApiOperation({ summary: 'Upload a media asset to the program media library' })
  @ApiParam({ name: 'programId', description: 'Program UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadMedia(
    @Param('programId') programId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('brand_id') brandId: string,
    @Body('user_id') userId: string,
    @Body('asset_type') assetType?: string,
    @Body('bucket') bucket = 'gallery',
  ) {
    if (!file) throw new BadRequestException('No file provided');
    this.logger.log(`Uploading media for program ${programId}: ${file.originalname}`);
    try {
      const uploadResult = await this.storageService.uploadFile(
        file,
        userId,
        brandId,
        bucket,
        programId,
        'ybb',
        undefined,
      );
      return {
        file: uploadResult.fileInfo,
        url: uploadResult.url,
        path: uploadResult.path,
        asset_type: assetType,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to upload media for program ${programId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Delete a program media asset' })
  @ApiParam({ name: 'programId', description: 'Program UUID' })
  @ApiParam({ name: 'fileId', description: 'File UUID' })
  @ApiQuery({ name: 'brand_id', required: true })
  @ApiResponse({ status: 204, description: 'File deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMedia(
    @Param('programId') programId: string,
    @Param('fileId') fileId: string,
    @Query('brand_id') brandId: string,
  ): Promise<void> {
    this.logger.log(`Deleting media file ${fileId} from program ${programId}`);
    await this.fileServiceClient.deleteMediaFile(fileId, brandId);
  }
}
