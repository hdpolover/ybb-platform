import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListBrandsQuery } from '../list-brands.query';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '@modules/brands/presentation/dto/brand.dto';

@QueryHandler(ListBrandsQuery)
export class ListBrandsHandler implements IQueryHandler<ListBrandsQuery> {
    constructor(
        @Inject('IBrandRepository')
        private readonly repository: IBrandRepository,
    ) { }

    async execute(query: ListBrandsQuery): Promise<BrandResponseDto[]> {
        const brands = await this.repository.findAll();

        return brands.map(brand => ({
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            description: brand.description || undefined,
            logoUrl: brand.logoUrl || undefined,
            websiteUrl: brand.websiteUrl || undefined,
            primaryColor: brand.primaryColor || undefined,
            contactEmail: brand.contactEmail || undefined,
            createdAt: brand.createdAt,
        }));
    }
}
