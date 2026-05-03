import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { UpdateBrandSettingsCommand } from '../update-brand-settings.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '../../../presentation/dto/brand.dto';
import { Brand } from '@core/entities/brand.entity';
import { BrandSetting } from '@core/entities/brand-setting.entity';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

@CommandHandler(UpdateBrandSettingsCommand)
export class UpdateBrandSettingsHandler implements ICommandHandler<UpdateBrandSettingsCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingRevalidation: LandingRevalidationService,
    ) {}

    async execute(command: UpdateBrandSettingsCommand): Promise<BrandResponseDto> {
        const { id, dto } = command;

        const brand = await this.brandRepository.findById(id);
        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }

        // Separate Brand fields vs Settings fields
        const brandUpdate: Partial<Brand> & { settings?: Record<string, unknown> } = {
            requireEmailVerification: dto.requireEmailVerification,
            defaultCurrency: dto.defaultCurrency,
            enableMultiCurrency: dto.enableMultiCurrency,
        };

        const settingsUpdate: Record<string, unknown> = {
            isMaintenanceMode: dto.isMaintenanceMode,
            maintenanceMessage: dto.maintenanceMessage,
            footerNavigation: dto.footerNavigation,
            usdInIdr: dto.usdInIdr,
            googleAnalyticsId: dto.googleAnalyticsId,
            pixelId: dto.pixelId,
            supportEmail: dto.supportEmail,
        };

        // Filter out undefined from settingsUpdate so we don't overwrite with undefined?
        // Actually Prisma update ignores undefined, but our Repository logic might need cleanup.
        // The repository uses "upsert". If we pass undefined to upsert, Prisma might complain or set null if nullable.
        // But here we are passing strict values from DTO.
        
        // Ensure settings object is passed only if there are settings to update
        if (Object.values(settingsUpdate).some(v => v !== undefined)) {
            brandUpdate.settings = settingsUpdate as unknown as BrandSetting & Record<string, unknown>;
        }

        const updatedBrand = await this.brandRepository.update(id, brandUpdate);

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
        dto.logoUrl = brand.logoUrl;
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
        dto.settings = brand.settings as unknown as Record<string, unknown> | null;
        return dto;
    }
}
