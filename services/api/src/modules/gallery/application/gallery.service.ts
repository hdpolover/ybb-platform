import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '@modules/brands/application/services/landing-cache-invalidation.service';
import { StorageService } from '../../files/application/storage.service';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';
import { UpdateGalleryItemDto } from '../dto/update-gallery-item.dto';

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  // ProgramGallery is landing-rendered (see landing/strategies/home.strategy.ts),
  // so a gallery write must clear the Postgres snapshot and nudge the Next.js
  // frontend cache too, or an admin's edit stays publicly stale until the
  // cache TTL expires. swallowErrors:true matches every other call site: the
  // DB write above has already succeeded by the time this runs, so a cache
  // failure must surface as a stale-until-TTL page, not a 500 on a request
  // that actually succeeded.
  private async invalidateLandingCaches(brandId: string): Promise<void> {
    await this.landingCacheInvalidation.invalidate(brandId, {
      clearSnapshot: true,
      bustProgramCache: true,
      swallowErrors: true,
      revalidate: { kind: 'homeAndSettings' },
    });
  }

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

    const created = await this.prisma.programGallery.create({
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
    await this.invalidateLandingCaches(program.brandId);
    return created;
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
    const program = await this.prisma.program.findUnique({
      where: { id: existing.programId },
      select: { brandId: true },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const updated = await this.prisma.programGallery.update({
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
    await this.invalidateLandingCaches(program.brandId);
    return updated;
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
    const program = await this.prisma.program.findUnique({
      where: { id: existing.programId },
      select: { brandId: true },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    await this.prisma.programGallery.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.invalidateLandingCaches(program.brandId);
  }
}
