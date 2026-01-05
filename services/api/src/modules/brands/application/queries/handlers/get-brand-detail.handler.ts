import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetBrandDetailQuery } from '../get-brand-detail.query';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '@modules/brands/presentation/dto/brand.dto';

@QueryHandler(GetBrandDetailQuery)
export class GetBrandDetailHandler implements IQueryHandler<GetBrandDetailQuery> {
    private readonly storageUrl: string;

    constructor(
        @Inject('IBrandRepository')
        private readonly repository: IBrandRepository,
        private readonly configService: ConfigService,
    ) { 
        this.storageUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
    }

    async execute(query: GetBrandDetailQuery): Promise<BrandResponseDto> {
        const brand = await this.repository.findById(query.id);

        if (!brand) {
            throw new NotFoundException('Brand not found');
        }

        return {
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            description: brand.description || null,
            logoUrl: brand.logoUrl 
                ? (brand.logoUrl.startsWith('http') ? brand.logoUrl : `${this.storageUrl}/${brand.logoUrl}`)
                : null,
            websiteUrl: brand.websiteUrl || null,
            primaryColor: brand.primaryColor || null,
            contactEmail: brand.contactEmail || null,
            createdAt: brand.createdAt,
            updatedAt: brand.updatedAt,
            deletedAt: brand.deletedAt || null,
        };
    }
}
