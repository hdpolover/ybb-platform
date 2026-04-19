import {
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
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { StorageService } from '../application/storage.service';

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
  ) {}

  @Get()
  @ApiOperation({ summary: 'List program media assets (media library)' })
  @ApiParam({ name: 'programId', description: 'Program UUID' })
  @ApiQuery({ name: 'brand_id', required: true })
  @ApiQuery({ name: 'asset_type', required: false, description: 'Filter: image | document | logo | banner | gallery | certificate | other' })
  @ApiQuery({ name: 'bucket', required: false, description: 'Filter by storage bucket/category' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of media files' })
  async listMedia(
    @Param('programId') programId: string,
    @Query('brand_id') brandId: string,
    @Query('asset_type') assetType?: string,
    @Query('bucket') bucket?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    // Return the raw paginated payload; the global TransformInterceptor adds
    // the `{ statusCode, message, data }` envelope. Wrapping here would
    // double-envelope and break the admin-dashboard's `listProgramMedia`.
    this.logger.log(`Listing media for program ${programId}`);
    return this.fileServiceClient.listProgramMedia({
      programId,
      brandId,
      assetType,
      bucket,
      page: Number(page),
      limit: Number(limit),
    });
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
    this.logger.log(`Uploading media for program ${programId}: ${file?.originalname}`);

    const uploadResult = await this.storageService.uploadFile(
      file,
      userId,
      brandId,
      bucket,
      programId,
      'ybb',   // tenant key — kept consistent with existing uploadFile calls
      undefined, // no participant_id for program-level media
    );

    // Raw payload; TransformInterceptor supplies the envelope.
    return {
      file: uploadResult.fileInfo,
      url: uploadResult.url,
      path: uploadResult.path,
      asset_type: assetType,
    };
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
