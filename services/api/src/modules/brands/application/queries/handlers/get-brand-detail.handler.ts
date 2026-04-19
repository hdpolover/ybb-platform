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
        const rawUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
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
            bannerUrl: brand.bannerUrl 
                ? (brand.bannerUrl.startsWith('http') ? brand.bannerUrl : `${this.storageUrl}/${brand.bannerUrl}`)
                : null,
            websiteUrl: brand.websiteUrl || null,
            primaryColor: brand.primaryColor || null,
            
            about: brand.about || null,
            vision: brand.vision || null,
            mission: brand.mission || null,

            contactEmail: brand.contactEmail || null,
            contactPhone: brand.contactPhone || null,
            contactWhatsapp: brand.contactWhatsapp || null,
            contactAddress: brand.contactAddress || null,
            socialMediaLinks: brand.socialMediaLinks || null,

            defaultLocation: brand.defaultLocation || null,
            defaultCountry: brand.defaultCountry || null,
            defaultTimezone: brand.defaultTimezone || null,

            requireEmailVerification: brand.requireEmailVerification,
            defaultCurrency: brand.defaultCurrency,
            enableMultiCurrency: brand.enableMultiCurrency,

            metaTitle: brand.metaTitle || null,
            metaDescription: brand.metaDescription || null,
            metaKeywords: brand.metaKeywords || null,
            isActive: brand.isActive,
            programCount: brand.programCount ?? 0,

            createdAt: brand.createdAt,
            updatedAt: brand.updatedAt,
            deletedAt: brand.deletedAt || null,
            settings: (brand.settings as unknown as Record<string, unknown>) || null,
        };
    }
}
