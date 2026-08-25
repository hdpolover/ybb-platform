import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetBrandDetailQuery } from '../get-brand-detail.query';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '@modules/brands/presentation/dto/brand.dto';
import { toSafeBrandSettingsResponse } from '@modules/brands/shared/brand-settings-response.util';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { resolveActiveProgram } from '@shared/utils/active-program-resolver';

@QueryHandler(GetBrandDetailQuery)
export class GetBrandDetailHandler implements IQueryHandler<GetBrandDetailQuery> {
    private readonly storageUrl: string;

    constructor(
        @Inject('IBrandRepository')
        private readonly repository: IBrandRepository,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const rawUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    }

    async execute(query: GetBrandDetailQuery): Promise<BrandResponseDto> {
        const brand = await this.repository.findById(query.id);

        if (!brand) {
            throw new NotFoundException('Brand not found');
        }

        // Same resolver settings.strategy.ts uses to pick the program whose
        // logoUrl (if set) wins over the brand's on the public site — the
        // admin UI needs this to warn editors that a brand-logo save may be
        // a no-op.
        const { program: activeProgram } = await resolveActiveProgram(
            (args) => this.prisma.program.findFirst({ ...args, select: { id: true, slug: true, logoUrl: true } }),
            brand.id,
        );

        return {
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            description: brand.description || null,
            tagline: brand.tagline || null,
            logoUrl: brand.logoUrl
                ? (brand.logoUrl.startsWith('http') ? brand.logoUrl : `${this.storageUrl}/${brand.logoUrl}`)
                : null,
            logoIconUrl: brand.logoIconUrl
                ? (brand.logoIconUrl.startsWith('http') ? brand.logoIconUrl : `${this.storageUrl}/${brand.logoIconUrl}`)
                : null,
            bannerUrl: brand.bannerUrl 
                ? (brand.bannerUrl.startsWith('http') ? brand.bannerUrl : `${this.storageUrl}/${brand.bannerUrl}`)
                : null,
            websiteUrl: brand.websiteUrl || null,
            landingUrl: brand.landingUrl || null,
            primaryColor: brand.primaryColor || null,
            
            about: brand.about || null,
            vision: brand.vision || null,
            mission: brand.mission || null,

            socialMediaLinks: brand.socialMediaLinks || null,

            defaultLocation: brand.defaultLocation || null,
            defaultCountry: brand.defaultCountry || null,
            defaultTimezone: brand.defaultTimezone || null,

            requireEmailVerification: brand.requireEmailVerification,
            defaultCurrency: brand.defaultCurrency,
            enableMultiCurrency: brand.enableMultiCurrency,

            isActive: brand.isActive,
            programCount: brand.programCount ?? 0,

            createdAt: brand.createdAt,
            updatedAt: brand.updatedAt,
            deletedAt: brand.deletedAt || null,
            settings: toSafeBrandSettingsResponse(brand.settings),
            activeProgram: activeProgram
                ? { id: activeProgram.id, slug: activeProgram.slug, logoUrl: activeProgram.logoUrl }
                : null,
        };
    }
}
