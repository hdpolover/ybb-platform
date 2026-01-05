import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListBrandsQuery } from '../list-brands.query';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '@modules/brands/presentation/dto/brand.dto';

@QueryHandler(ListBrandsQuery)
export class ListBrandsHandler implements IQueryHandler<ListBrandsQuery> {
    private readonly storageUrl: string;

    constructor(
        @Inject('IBrandRepository')
        private readonly repository: IBrandRepository,
        private readonly configService: ConfigService,
    ) { 
        this.storageUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
    }

    async execute(query: ListBrandsQuery): Promise<BrandResponseDto[]> {
        const brands = await this.repository.findAll();

        return brands.map(brand => ({
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
        }));
    }
}
