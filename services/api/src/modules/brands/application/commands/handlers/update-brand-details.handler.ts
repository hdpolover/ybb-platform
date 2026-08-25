import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { UpdateBrandDetailsCommand } from '../update-brand-details.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '../../../presentation/dto/brand.dto';
import { StorageService } from '../../../../files/application/storage.service';
import { Brand } from '@core/entities/brand.entity';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { BrandLogoAssetsService } from '../../services/brand-logo-assets.service';
import { Prisma } from '@prisma/client';
import { toSafeBrandSettingsResponse } from '../../../shared/brand-settings-response.util';

@CommandHandler(UpdateBrandDetailsCommand)
export class UpdateBrandDetailsHandler implements ICommandHandler<UpdateBrandDetailsCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly brandLogoAssetsService: BrandLogoAssetsService,
        private readonly landingRevalidation: LandingRevalidationService,
    ) {}

    async execute(command: UpdateBrandDetailsCommand): Promise<BrandResponseDto> {
        const { id, dto, files, userId } = command;

        const brand = await this.brandRepository.findById(id);
        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }

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
                    userId,
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

        const updatedBrand = await this.brandRepository.update(id, {
            description: dto.description,
            tagline: dto.tagline,
            logoUrl: dto.logoUrl,
            bannerUrl: dto.bannerUrl,
            about: dto.about,
            vision: dto.vision,
            mission: dto.mission,
            primaryColor: dto.primaryColor,
            websiteUrl: dto.websiteUrl,
            landingUrl: dto.landingUrl,
            contactEmail: dto.contactEmail,
            contactPhone: dto.contactPhone,
            contactWhatsapp: dto.contactWhatsapp,
            contactAddress: dto.contactAddress,
            socialMediaLinks: dto.socialMediaLinks,
            defaultLocation: dto.defaultLocation,
            defaultCountry: dto.defaultCountry,
            defaultTimezone: dto.defaultTimezone,
            metaTitle: dto.metaTitle,
            metaDescription: dto.metaDescription,
            metaKeywords: dto.metaKeywords,
        });

        await Promise.all([
            this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId: id } }),
            this.cacheService.invalidateBrandLandingCaches(id),
        ]);
        await this.landingRevalidation.revalidateForBrand(id, {
            landingUrl: updatedBrand.landingUrl,
            websiteUrl: updatedBrand.websiteUrl,
        });
        return this.mapToDto(updatedBrand);
    }

    private mapToDto(brand: Brand): BrandResponseDto {
        const dto = new BrandResponseDto();
        dto.id = brand.id;
        dto.name = brand.name;
        dto.slug = brand.slug;
        dto.description = brand.description;
        dto.tagline = brand.tagline;
        dto.logoUrl = brand.logoUrl;
        dto.logoIconUrl = brand.logoIconUrl;
        dto.bannerUrl = brand.bannerUrl;
        dto.websiteUrl = brand.websiteUrl;
        dto.landingUrl = brand.landingUrl;
        dto.primaryColor = brand.primaryColor;
        dto.about = brand.about;
        dto.vision = brand.vision;
        dto.mission = brand.mission;
        dto.contactEmail = brand.contactEmail;
        dto.contactPhone = brand.contactPhone;
        dto.contactWhatsapp = brand.contactWhatsapp;
        dto.contactAddress = brand.contactAddress;
        dto.socialMediaLinks = brand.socialMediaLinks;
        dto.defaultLocation = brand.defaultLocation;
        dto.defaultCountry = brand.defaultCountry;
        dto.defaultTimezone = brand.defaultTimezone;
        dto.requireEmailVerification = brand.requireEmailVerification;
        dto.defaultCurrency = brand.defaultCurrency;
        dto.enableMultiCurrency = brand.enableMultiCurrency;
        dto.metaTitle = brand.metaTitle;
        dto.metaDescription = brand.metaDescription;
        dto.metaKeywords = brand.metaKeywords;
        dto.createdAt = brand.createdAt;
        dto.updatedAt = brand.updatedAt;
        dto.deletedAt = brand.deletedAt;
        dto.settings = toSafeBrandSettingsResponse(brand.settings);
        return dto;
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
