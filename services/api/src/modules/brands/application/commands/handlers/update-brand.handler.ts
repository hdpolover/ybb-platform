import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateBrandCommand } from '../update-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { StorageService } from '../../../../files/application/storage.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@CommandHandler(UpdateBrandCommand)
export class UpdateBrandHandler implements ICommandHandler<UpdateBrandCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly storageService: StorageService,
        private readonly cacheService: CacheService,
        private readonly prisma: PrismaService,
        private readonly landingRevalidation: LandingRevalidationService,
    ) { }

    async execute(command: UpdateBrandCommand): Promise<Brand> {
        const { id, dto, files, userId } = command;
        const brand = await this.brandRepository.findById(id);
        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }

        if (files) {
            if (files.logo) {
                const result = await this.storageService.uploadFile(
                    files.logo,
                    userId || 'system',
                    brand.id,
                    'brands/logos',
                    undefined
                );
                dto.logoUrl = result.url;
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
}
