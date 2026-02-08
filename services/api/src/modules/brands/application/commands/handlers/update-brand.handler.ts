import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateBrandCommand } from '../update-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { StorageService } from '../../../../files/application/storage.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';

@CommandHandler(UpdateBrandCommand)
export class UpdateBrandHandler implements ICommandHandler<UpdateBrandCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly storageService: StorageService,
        private readonly cacheService: CacheService,
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

        return updatedBrand;
    }

    /**
     * Invalidate all landing page caches when brand is updated
     */
    private async invalidateLandingCaches(brandId: string): Promise<void> {
        try {
            await this.cacheService.invalidateByPattern(`landing:*:${brandId}`);
        } catch (error) {
            console.error('Failed to invalidate landing caches:', error);
        }
    }
}
