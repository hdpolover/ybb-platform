import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateBrandCommand } from '../update-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { StorageService } from '../../../../files/application/storage.service';
import { LandingCacheInvalidationService } from '../../services/landing-cache-invalidation.service';
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
        private readonly prisma: PrismaService,
        private readonly brandLogoAssetsService: BrandLogoAssetsService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
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

        // Bust all three landing cache layers (Postgres snapshot, Redis,
        // and the participant frontend's Next.js unstable_cache) in one
        // call. Pass the fresh websiteUrl/landingUrl so the revalidate hook
        // doesn't need to re-read the DB. Brand-detail edits don't touch
        // program-scoped landing data, so program:* is left alone.
        await this.landingCacheInvalidation.invalidate(id, {
            clearSnapshot: true,
            bustProgramCache: false,
            swallowErrors: true,
            revalidate: {
                kind: 'brand',
                urls: { landingUrl: updatedBrand.landingUrl, websiteUrl: updatedBrand.websiteUrl },
            },
        });

        return updatedBrand;
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
