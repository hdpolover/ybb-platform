import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListBrandsQuery } from '../list-brands.query';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '@modules/brands/presentation/dto/brand.dto';
import { toSafeBrandSettingsResponse } from '@modules/brands/shared/brand-settings-response.util';

@QueryHandler(ListBrandsQuery)
export class ListBrandsHandler implements IQueryHandler<ListBrandsQuery> {
    private readonly storageUrl: string;

    constructor(
        @Inject('IBrandRepository')
        private readonly repository: IBrandRepository,
        private readonly configService: ConfigService,
    ) { 
        const rawUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
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
            logoIconUrl: brand.logoIconUrl
                ? (brand.logoIconUrl.startsWith('http') ? brand.logoIconUrl : `${this.storageUrl}/${brand.logoIconUrl}`)
                : (brand.logoUrl
                    ? (brand.logoUrl.startsWith('http') ? brand.logoUrl : `${this.storageUrl}/${brand.logoUrl}`)
                    : null),
            bannerUrl: brand.bannerUrl 
                ? (brand.bannerUrl.startsWith('http') ? brand.bannerUrl : `${this.storageUrl}/${brand.bannerUrl}`)
                : null,
            websiteUrl: brand.websiteUrl || null,
            landingUrl: brand.landingUrl || null,
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
            settings: toSafeBrandSettingsResponse(brand.settings),
        }));
    }
}
