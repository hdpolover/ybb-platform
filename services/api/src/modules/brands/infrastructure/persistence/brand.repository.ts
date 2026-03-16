import { Injectable } from '@nestjs/common';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { BrandSetting } from '@core/entities/brand-setting.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class BrandRepository implements IBrandRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(): Promise<Brand[]> {
        const categories = await this.prisma.brand.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            include: {
                settings: true,
                programs: {
                    where: { deletedAt: null },
                    select: { id: true },
                },
            },
        });
        return categories.map((c) => this.mapToEntity(c));
    }

    async findById(id: string): Promise<Brand | null> {
        const category = await this.prisma.brand.findUnique({
            where: { id },
            include: { settings: true },
        });
        return category ? this.mapToEntity(category) : null;
    }

    async findBySlug(slug: string): Promise<Brand | null> {
        const category = await this.prisma.brand.findUnique({
            where: { slug },
            include: { settings: true },
        });
        return category ? this.mapToEntity(category) : null;
    }

    async create(data: Partial<Brand>): Promise<Brand> {
        const category = await this.prisma.brand.create({
            data: {
                name: data.name!,
                slug: data.slug!,
                description: data.description,
                logoUrl: data.logoUrl,
                websiteUrl: data.websiteUrl,
                primaryColor: data.primaryColor,
                contactEmail: data.contactEmail,
                isActive: data.isActive ?? true,
            },
            include: { settings: true },
        });
        return this.mapToEntity(category);
    }

    async update(id: string, data: Partial<Brand>): Promise<Brand> {
        let settingsUpdate: any = undefined;
        if (data.settings) {
            settingsUpdate = {
                upsert: {
                    create: {
                        isMaintenanceMode: data.settings.isMaintenanceMode,
                        maintenanceMessage: data.settings.maintenanceMessage,
                        maintenanceScheduledEnd: data.settings.maintenanceScheduledEnd,
                        footerNavigation: data.settings.footerNavigation ?? [],
                        usdInIdr: data.settings.usdInIdr,
                        googleAnalyticsId: data.settings.googleAnalyticsId,
                        pixelId: data.settings.pixelId,
                        supportEmail: data.settings.supportEmail,
                    },
                    update: {
                        isMaintenanceMode: data.settings.isMaintenanceMode,
                        maintenanceMessage: data.settings.maintenanceMessage,
                        maintenanceScheduledEnd: data.settings.maintenanceScheduledEnd,
                        footerNavigation: data.settings.footerNavigation ?? [],
                        usdInIdr: data.settings.usdInIdr,
                        googleAnalyticsId: data.settings.googleAnalyticsId,
                        pixelId: data.settings.pixelId,
                        supportEmail: data.settings.supportEmail,
                    }
                }
            };
        }

        const category = await this.prisma.brand.update({
            where: { id },
            data: {
                name: data.name,
                slug: data.slug,
                description: data.description,
                logoUrl: data.logoUrl,
                bannerUrl: data.bannerUrl,
                websiteUrl: data.websiteUrl,
                primaryColor: data.primaryColor,
                
                about: data.about,
                vision: data.vision,
                mission: data.mission,

                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                contactWhatsapp: data.contactWhatsapp,
                contactAddress: data.contactAddress,
                socialMediaLinks: data.socialMediaLinks ?? undefined,

                defaultLocation: data.defaultLocation,
                defaultCountry: data.defaultCountry,
                defaultTimezone: data.defaultTimezone,

                requireEmailVerification: data.requireEmailVerification,
                defaultCurrency: data.defaultCurrency,
                enableMultiCurrency: data.enableMultiCurrency,

                metaTitle: data.metaTitle,
                metaDescription: data.metaDescription,
                metaKeywords: data.metaKeywords,
                
                isActive: data.isActive,
                
                settings: settingsUpdate,
            },
            include: { settings: true },
        });
        return this.mapToEntity(category);
    }

    async delete(id: string): Promise<void> {
        // Soft delete
        await this.prisma.brand.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });
    }

    private mapToEntity(prismaEntity: any): Brand {
        let settings: BrandSetting | null = null;
        if (prismaEntity.settings) {
            settings = new BrandSetting(
                prismaEntity.settings.id,
                prismaEntity.settings.brandId,
                prismaEntity.settings.isMaintenanceMode,
                prismaEntity.settings.maintenanceMessage,
                prismaEntity.settings.maintenanceScheduledEnd,
                prismaEntity.settings.footerNavigation,
                prismaEntity.settings.usdInIdr ? Number(prismaEntity.settings.usdInIdr) : 16000,
                prismaEntity.settings.googleAnalyticsId,
                prismaEntity.settings.pixelId,
                prismaEntity.settings.supportEmail,
                prismaEntity.settings.createdAt,
                prismaEntity.settings.updatedAt,
                prismaEntity.settings.deletedAt,
            );
        }

        return new Brand(
            prismaEntity.id,
            prismaEntity.name,
            prismaEntity.slug,
            prismaEntity.description,
            prismaEntity.logoUrl,
            prismaEntity.bannerUrl, // New
            prismaEntity.websiteUrl,
            prismaEntity.primaryColor,

            prismaEntity.about,
            prismaEntity.vision,
            prismaEntity.mission,

            prismaEntity.contactEmail,
            prismaEntity.contactPhone,
            prismaEntity.contactWhatsapp,
            prismaEntity.contactAddress,
            prismaEntity.socialMediaLinks,

            prismaEntity.defaultLocation,
            prismaEntity.defaultCountry,
            prismaEntity.defaultTimezone,

            prismaEntity.requireEmailVerification ?? true,
            prismaEntity.defaultCurrency ?? 'USD',
            prismaEntity.enableMultiCurrency ?? false,

            prismaEntity.metaTitle,
            prismaEntity.metaDescription,
            prismaEntity.metaKeywords,

            prismaEntity.createdAt,
            prismaEntity.updatedAt,
            prismaEntity.deletedAt,
            prismaEntity.isActive,
            settings,
            prismaEntity.programs?.length ?? 0,
        );
    }
}
