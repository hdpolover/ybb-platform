import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../files/application/storage.service';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';
import { UpdateGalleryItemDto } from '../dto/update-gallery-item.dto';

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Accepts two shapes:
   *   (a) legacy multipart — `file` present → service uploads to storage;
   *   (b) presigned flow — `image_url` present → client already uploaded, we
   *       just persist the URL + metadata.
   * Exactly one of the two must be provided.
   */
  async create(
    dto: CreateGalleryItemDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    if (!file && !dto.image_url) {
      throw new BadRequestException('Provide either a file or an image_url.');
    }

    const program = await this.prisma.program.findUnique({
      where: { id: dto.program_id },
      include: { brand: true },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    let imageUrl = dto.image_url;
    if (file) {
      const uploadResult = await this.storageService.uploadFile(
        file,
        userId,
        program.brandId,
        'gallery',
        dto.program_id,
      );
      imageUrl = uploadResult.url;
    }

    return this.prisma.programGallery.create({
      data: {
        programId: dto.program_id,
        title: dto.title,
        description: dto.description,
        year: dto.year,
        type: dto.type || 'image',
        order: dto.order ?? 0,
        imageUrl: imageUrl!,
      },
    });
  }

  async findAll(programId: string) {
    return this.prisma.programGallery.findMany({
      where: {
        programId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { order: 'asc' },
    });
  }

  async update(id: string, dto: UpdateGalleryItemDto) {
    const existing = await this.prisma.programGallery.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Gallery item ${id} not found`);
    }
    return this.prisma.programGallery.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        year: dto.year,
        imageUrl: dto.image_url,
        order: dto.order,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Soft delete — keeps the row for audit while hiding it from findAll.
   * The underlying Spaces object is NOT removed; a background job can sweep
   * orphaned storage paths later if needed.
   */
  async remove(id: string) {
    const existing = await this.prisma.programGallery.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Gallery item ${id} not found`);
    }
    await this.prisma.programGallery.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
