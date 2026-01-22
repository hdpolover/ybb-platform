import { 
  Controller, 
  Post, 
  UseGuards, 
  UseInterceptors, 
  UploadedFile, 
  Body, 
  Get, 
  Query, 
  Req,
  Logger
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';
import { GalleryService } from '../application/gallery.service';

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  private readonly logger = new Logger(GalleryController.name);

  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a gallery item (image/video)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        program_id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string', default: 'image' },
        order: { type: 'number' },
      },
      required: ['file', 'program_id'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadGalleryItem(
    @UploadedFile() file: any,
    @Body() dto: CreateGalleryItemDto,
    @Req() req: any, 
  ) {
    this.logger.log(`Uploading gallery item for program ${dto.program_id}`);
    const userId = req.user?.userId; // Assumes JwtAuthGuard populates request.user with { userId }
    return this.galleryService.create(dto, file, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get gallery items for a program' })
  async getGallery(@Query('program_id') programId: string) {
    return this.galleryService.findAll(programId);
  }
}
