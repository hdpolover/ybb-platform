import { Injectable } from '@nestjs/common';
import { ISponsorRepository } from '@core/interfaces/repositories/sponsor.repository.interface';
import { Sponsor } from '@core/entities/sponsor.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class SponsorRepository implements ISponsorRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByBrandId(brandId: string): Promise<Sponsor[]> {
        const sponsors = await this.prisma.sponsor.findMany({
            where: { programCategoryId: brandId, isActive: true },
            orderBy: { order: 'asc' },
        });
        return sponsors.map(this.mapToEntity);
    }

    private mapToEntity(prismaEntity: any): Sponsor {
        return new Sponsor(
            prismaEntity.id,
            prismaEntity.name,
            prismaEntity.type,
            prismaEntity.logoUrl,
            prismaEntity.websiteUrl,
            prismaEntity.description,
            prismaEntity.tier,
            prismaEntity.order,
            prismaEntity.isActive,
        );
    }
}
