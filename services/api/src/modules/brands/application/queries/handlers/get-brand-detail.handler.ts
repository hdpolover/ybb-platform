import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetBrandDetailQuery } from '../get-brand-detail.query';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '@modules/brands/presentation/dto/brand.dto';

@QueryHandler(GetBrandDetailQuery)
export class GetBrandDetailHandler implements IQueryHandler<GetBrandDetailQuery> {
    constructor(
        @Inject('IBrandRepository')
        private readonly repository: IBrandRepository,
    ) { }

    async execute(query: GetBrandDetailQuery): Promise<BrandResponseDto> {
        const brand = await this.repository.findById(query.id);

        if (!brand) {
            throw new NotFoundException('Brand not found');
        }

        return {
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            description: brand.description || undefined,
            logoUrl: brand.logoUrl || undefined,
            websiteUrl: brand.websiteUrl || undefined,
            primaryColor: brand.primaryColor || undefined,
            contactEmail: brand.contactEmail || undefined,
            createdAt: brand.createdAt,
        };
    }
}
