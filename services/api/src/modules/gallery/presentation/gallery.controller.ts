import {
  Controller,
  Post,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';
import { UpdateGalleryItemDto } from '../dto/update-gallery-item.dto';
import { GalleryService } from '../application/gallery.service';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  private readonly logger = new Logger(GalleryController.name);

  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a gallery item. Send multipart with `file`, or JSON with `image_url` (after a presigned upload).',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        image_url: { type: 'string', format: 'uri' },
        program_id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string' },
        year: { type: 'number' },
        type: { type: 'string', default: 'image' },
        order: { type: 'number' },
      },
      required: ['program_id'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @AuditTrail({ entityType: 'ProgramGallery', action: ChangeType.create })
  async uploadGalleryItem(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateGalleryItemDto,
    @Req() req: Request,
  ) {
    this.logger.log(
      `Creating gallery item for program ${dto.program_id} (${file ? 'multipart' : 'presigned'})`,
    );
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    return this.galleryService.create(dto, file, userId ?? '');
  }

  @Get()
  @ApiOperation({ summary: 'Get gallery items for a program' })
  async getGallery(@Query('program_id') programId: string) {
    return this.galleryService.findAll(programId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a gallery item (title, description, year, image_url, order, isActive)' })
  @AuditTrail({ entityType: 'ProgramGallery', action: ChangeType.update })
  async updateGalleryItem(
    @Param('id') id: string,
    @Body() dto: UpdateGalleryItemDto,
  ) {
    return this.galleryService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a gallery item' })
  @AuditTrail({ entityType: 'ProgramGallery', action: ChangeType.delete })
  async deleteGalleryItem(@Param('id') id: string) {
    await this.galleryService.remove(id);
  }
}
