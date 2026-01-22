import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../files/application/storage.service';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';

@Injectable()
export class GalleryService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
  }

  async create(dto: CreateGalleryItemDto, file: Express.Multer.File, userId: string) {
    // 1. Validate Program and get Brand ID (Program Category)
    const program = await this.prisma.program.findUnique({
      where: { id: dto.program_id },
      include: { programCategory: true } // Assuming relation exists
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const brandId = program.programCategoryId;

    // 2. Upload to File Service
    const uploadResult = await this.storageService.uploadFile(
      file,
      userId,
      brandId,
      'gallery', 
      dto.program_id
    );

    // 3. Create DB Record
    return this.prisma.programGallery.create({
      data: {
        programId: dto.program_id,
        title: dto.title,
        description: dto.description,
        type: dto.type || 'image',
        order: dto.order || 0,
        imageUrl: uploadResult.url, 
      }
    });
  }

  async findAll(programId: string) {
    return this.prisma.programGallery.findMany({
      where: {
        programId: programId,
        isActive: true,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }
}
