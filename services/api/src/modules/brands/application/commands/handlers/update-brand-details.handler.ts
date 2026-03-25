import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { UpdateBrandDetailsCommand } from '../update-brand-details.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { BrandResponseDto } from '../../../presentation/dto/brand.dto';
import { StorageService } from '../../../../files/application/storage.service';
import { Brand } from '@core/entities/brand.entity';

@CommandHandler(UpdateBrandDetailsCommand)
export class UpdateBrandDetailsHandler implements ICommandHandler<UpdateBrandDetailsCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly storageService: StorageService,
    ) {}

    async execute(command: UpdateBrandDetailsCommand): Promise<BrandResponseDto> {
        const { id, dto, files, userId } = command;

        const brand = await this.brandRepository.findById(id);
        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }

        if (files) {
            if (files.logo) {
                const result = await this.storageService.uploadFile(
                    files.logo,
                    userId,
                    brand.id,
                    'brands/logos',
                    undefined
                );
                dto.logoUrl = result.url;
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

        const updatedBrand = await this.brandRepository.update(id, {
            description: dto.description,
            logoUrl: dto.logoUrl,
            bannerUrl: dto.bannerUrl,
            about: dto.about,
            vision: dto.vision,
            mission: dto.mission,
            primaryColor: dto.primaryColor,
            websiteUrl: dto.websiteUrl,
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
