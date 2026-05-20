import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateBrandCommand } from '../update-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { StorageService } from '../../../../files/application/storage.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BrandLogoAssetsService } from '../../services/brand-logo-assets.service';
import { Prisma } from '@prisma/client';
import { ensureBrandIdentityAvailable } from '../../../shared/brand-identity.utils';

@CommandHandler(UpdateBrandCommand)
export class UpdateBrandHandler implements ICommandHandler<UpdateBrandCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly storageService: StorageService,
        private readonly cacheService: CacheService,
        private readonly prisma: PrismaService,
        private readonly brandLogoAssetsService: BrandLogoAssetsService,
        private readonly landingRevalidation: LandingRevalidationService,
    ) { }

    async execute(command: UpdateBrandCommand): Promise<Brand> {
        const { id, dto, files, userId } = command;
        const brand = await this.brandRepository.findById(id);
        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }

        await ensureBrandIdentityAvailable(this.brandRepository, {
            currentBrandId: brand.id,
            name: dto.name ?? brand.name,
            slug: dto.slug ?? brand.slug,
        });

        if (files) {
            if (files.logo) {
                const logoAssets = await this.brandLogoAssetsService.uploadBrandLogoAssets(
                    files.logo,
                    brand.id,
                );
                dto.logoUrl = logoAssets.logoUrl;
                await this.updateBrandAssetMetadata(brand.id, logoAssets.metadataPatch);
                await this.prisma.brand.update({
                    where: { id: brand.id },
                    data: { logoIconUrl: logoAssets.logoIconUrl },
                });
            }

            if (files.banner) {
                const result = await this.storageService.uploadFile(
                    files.banner,
                    userId || 'system',
                    brand.id,
                    'brands/banners',
                    undefined
                );
                dto.bannerUrl = result.url;
            }
        }

        if (!files?.logo && dto.logoUrl) {
            await this.updateBrandAssetMetadata(brand.id, {
                favicon_url: dto.logoUrl,
                apple_icon_url: dto.logoUrl,
            });
            await this.prisma.brand.update({
                where: { id: brand.id },
                data: { logoIconUrl: dto.logoUrl },
            });
        }


        const updatedBrand = await this.brandRepository.update(id, dto);

        // Invalidate all landing page caches for this brand
        await this.invalidateLandingCaches(id);
        // Also nudge THIS brand's landing Next.js app to drop its server-side
        // settings cache so logo/color changes show up instantly. Pass the
        // fresh websiteUrl so we don't re-read the DB.
        await this.landingRevalidation.revalidateForBrand(id, {
            landingUrl: updatedBrand.landingUrl,
            websiteUrl: updatedBrand.websiteUrl,
        });

        return updatedBrand;
    }

    /**
     * Invalidate all landing page caches when brand is updated
     */
    private async invalidateLandingCaches(brandId: string): Promise<void> {
        try {
            await Promise.all([
                this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId } }),
                this.cacheService.invalidateBrandLandingCaches(brandId),
            ]);
        } catch (error) {
            console.error('Failed to invalidate landing caches:', error);
        }
    }

    private async updateBrandAssetMetadata(brandId: string, patch: Record<string, string>): Promise<void> {
        const current = await this.brandRepository.getMetadata(brandId);
        await this.prisma.brand.update({
            where: { id: brandId },
            data: {
                metadata: {
                    ...(current ?? {}),
                    ...patch,
                } as Prisma.InputJsonValue,
            },
        });
    }
}
