import { Injectable } from '@nestjs/common';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class BrandRepository implements IBrandRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(): Promise<Brand[]> {
        const categories = await this.prisma.programCategory.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        return categories.map(this.mapToEntity);
    }

    async findById(id: string): Promise<Brand | null> {
        const category = await this.prisma.programCategory.findUnique({
            where: { id },
        });
        return category ? this.mapToEntity(category) : null;
    }

    async findBySlug(slug: string): Promise<Brand | null> {
        const category = await this.prisma.programCategory.findUnique({
            where: { slug },
        });
        return category ? this.mapToEntity(category) : null;
    }

    private mapToEntity(prismaEntity: any): Brand {
        return new Brand(
            prismaEntity.id,
            prismaEntity.name,
            prismaEntity.slug,
            prismaEntity.description,
            prismaEntity.logoUrl,
            prismaEntity.websiteUrl,
            prismaEntity.primaryColor,
            prismaEntity.contactEmail,
            prismaEntity.createdAt,
            prismaEntity.isActive,
        );
    }
}
