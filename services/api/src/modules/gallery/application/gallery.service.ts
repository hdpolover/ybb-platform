import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';

@Injectable()
export class GalleryService {
  private readonly storagePublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileServiceClient,
    private readonly configService: ConfigService,
  ) {
    this.storagePublicUrl = this.configService.get<string>('STORAGE_PUBLIC_URL', '');
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
    const uploadResult = await this.fileService.uploadFile(
      file,
      userId,
      brandId,
      'gallery', 
      dto.program_id
    );

    if (!uploadResult || !uploadResult.file) {
        throw new InternalServerErrorException('Failed to upload file');
    }

    const fileData = uploadResult.file;
    // Construct public URL: https://BUCKET.REGION.digitaloceanspaces.com/KEY
    // Assuming STORAGE_PUBLIC_URL is https://sgp1.digitaloceanspaces.com
    // And we want https://ybb.sgp1.digitaloceanspaces.com/...
    
    let imageUrl = '';
    if (fileData.storage_path) {
       // Check if storageUrl already has bucket, or just region
       // The env STORAGE_PUBLIC_URL=https://sgp1.digitaloceanspaces.com
       // We need to form https://{bucket}.{region_url}/{path} OR https://{region_url}/{bucket}/{path}
       // DO Spaces standard: https://{bucket}.{region}.digitaloceanspaces.com
       
       // For now, let's assume we construct it manually or just store the relative path if the frontend handles it.
       // But DB schema says imageUrl VarChar(500), usually expects full URL.
       
       const bucket = fileData.bucket || 'ybb';
       // Clean up leading slash
       const path = fileData.storage_path.startsWith('/') ? fileData.storage_path.substring(1) : fileData.storage_path;
       
       // Fallback logic for URL construction
       imageUrl = `https://${bucket}.${this.storagePublicUrl.replace('https://', '')}/${path}`;
    }

    // 3. Create DB Record
    return this.prisma.programGallery.create({
      data: {
        programId: dto.program_id,
        title: dto.title,
        description: dto.description,
        type: dto.type || 'image',
        order: dto.order || 0,
        imageUrl: imageUrl, 
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
