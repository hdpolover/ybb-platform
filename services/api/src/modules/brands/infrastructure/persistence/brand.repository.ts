import { Injectable } from '@nestjs/common';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { BrandSetting } from '@core/entities/brand-setting.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { buildDeletedBrandName, buildDeletedBrandSlug } from '../../shared/brand-identity.utils';

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
            include: {
                settings: true,
                // programs id-only select is used by mapToEntity to compute programCount.
                // Without it, detail views always report 0.
                programs: { where: { deletedAt: null }, select: { id: true } },
            },
        });
        return category ? this.mapToEntity(category) : null;
    }

    async findByName(name: string): Promise<Brand | null> {
        const category = await this.prisma.brand.findUnique({
            where: { name },
            include: {
                settings: true,
                programs: { where: { deletedAt: null }, select: { id: true } },
            },
        });
        return category ? this.mapToEntity(category) : null;
    }

    async findBySlug(slug: string): Promise<Brand | null> {
        const category = await this.prisma.brand.findUnique({
            where: { slug },
            include: {
                settings: true,
                programs: { where: { deletedAt: null }, select: { id: true } },
            },
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
                logoIconUrl: data.logoIconUrl,
                websiteUrl: data.websiteUrl,
                landingUrl: data.landingUrl,
                primaryColor: data.primaryColor,
                isActive: data.isActive ?? true,
            },
            include: { settings: true },
        });
        return this.mapToEntity(category);
    }

    async update(id: string, data: Partial<Brand>): Promise<Brand> {
        let settingsUpdate: { upsert: Prisma.BrandSettingUpsertWithoutBrandInput } | undefined = undefined;
        if (data.settings) {
            const settingsFields = {
                isMaintenanceMode: data.settings.isMaintenanceMode,
                maintenanceMessage: data.settings.maintenanceMessage,
                maintenanceScheduledEnd: data.settings.maintenanceScheduledEnd,
                footerNavigation: data.settings.footerNavigation ?? [],
                usdInIdr: data.settings.usdInIdr,
                googleAnalyticsId: data.settings.googleAnalyticsId,
                pixelId: data.settings.pixelId,
                supportEmail: data.settings.supportEmail,
                capiAccessToken: data.settings.capiAccessToken,
                capiTestEventCode: data.settings.capiTestEventCode,
            };
            settingsUpdate = {
                upsert: {
                    create: settingsFields as unknown as Prisma.BrandSettingCreateWithoutBrandInput,
                    update: settingsFields as unknown as Prisma.BrandSettingUpdateWithoutBrandInput,
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
                logoIconUrl: data.logoIconUrl,
                bannerUrl: data.bannerUrl,
                websiteUrl: data.websiteUrl,
                landingUrl: data.landingUrl,
                primaryColor: data.primaryColor,
                
                about: data.about,
                vision: data.vision,
                mission: data.mission,

                socialMediaLinks: data.socialMediaLinks ?? undefined,

                defaultLocation: data.defaultLocation,
                defaultCountry: data.defaultCountry,
                defaultTimezone: data.defaultTimezone,

                requireEmailVerification: data.requireEmailVerification,
                defaultCurrency: data.defaultCurrency,
                enableMultiCurrency: data.enableMultiCurrency,

                tagline: data.tagline,

                isActive: data.isActive,
                
                settings: settingsUpdate,
            },
            include: { settings: true },
        });
        return this.mapToEntity(category);
    }

    async getMetadata(id: string): Promise<Record<string, unknown> | null> {
        const brand = await this.prisma.brand.findUnique({
            where: { id },
            select: { metadata: true },
        });
        if (!brand) return null;
        return (brand.metadata as Record<string, unknown>) ?? {};
    }

    async updateMetadata(id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
        const existing = await this.getMetadata(id);
        if (existing === null) {
            throw new Error(`Brand with ID ${id} not found`);
        }
        const merged = { ...existing, ...patch };
        await this.prisma.brand.update({
            where: { id },
            data: { metadata: merged as Prisma.InputJsonValue },
        });
        return merged;
    }

    async delete(id: string): Promise<void> {
        const brand = await this.prisma.brand.findUnique({
            where: { id },
            select: { name: true, slug: true },
        });

        await this.prisma.brand.update({
            where: { id },
            data: {
                name: buildDeletedBrandName(brand?.name ?? id, id),
                slug: buildDeletedBrandSlug(brand?.slug ?? id, id),
                deletedAt: new Date(),
                isActive: false,
            },
        });
    }

    private mapToEntity(prismaEntity: Prisma.BrandGetPayload<{ include: { settings: true } }>): Brand {
        let settings: BrandSetting | null = null;
        if (prismaEntity.settings) {
            settings = new BrandSetting(
                prismaEntity.settings.id,
                prismaEntity.settings.brandId,
                prismaEntity.settings.isMaintenanceMode,
                prismaEntity.settings.maintenanceMessage,
                prismaEntity.settings.maintenanceScheduledEnd,
                prismaEntity.settings.footerNavigation as unknown as Record<string, unknown>,
                prismaEntity.settings.usdInIdr ? Number(prismaEntity.settings.usdInIdr) : 16000,
                prismaEntity.settings.googleAnalyticsId,
                prismaEntity.settings.pixelId,
                prismaEntity.settings.supportEmail,
                prismaEntity.settings.capiAccessToken,
                prismaEntity.settings.capiTestEventCode,
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
            prismaEntity.logoIconUrl,
            prismaEntity.bannerUrl, // New
            prismaEntity.websiteUrl,
            prismaEntity.landingUrl,
            prismaEntity.primaryColor,

            prismaEntity.about,
            prismaEntity.vision,
            prismaEntity.mission,

            prismaEntity.socialMediaLinks as unknown as Record<string, string> | null,

            prismaEntity.defaultLocation,
            prismaEntity.defaultCountry,
            prismaEntity.defaultTimezone,

            prismaEntity.requireEmailVerification ?? true,
            prismaEntity.defaultCurrency ?? 'USD',
            prismaEntity.enableMultiCurrency ?? false,

            prismaEntity.createdAt,
            prismaEntity.updatedAt,
            prismaEntity.deletedAt,
            prismaEntity.isActive,
            settings,
            (prismaEntity as unknown as { programs?: { id: string }[] }).programs?.length ?? 0,
            prismaEntity.tagline ?? null,
        );
    }
}
