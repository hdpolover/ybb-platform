import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';
import { LandingSettingsResponseDto } from '../dto/landing-settings.dto';

@Injectable()
export class SettingsStrategy {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    async getData(category: Brand | null): Promise<LandingSettingsResponseDto> {
        // Check cache first
        const cacheKey = CACHE_KEYS.LANDING_SETTINGS(category?.id || 'default');
        const cached = await this.cacheService.get<LandingSettingsResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        if (!category) {
            return {
                maintenance: { is_maintenance_mode: false },
                brand: { name: 'Youth Break the Boundaries', logo_url: '', description: undefined, logo_white_url: undefined, logo_color_url: undefined, logo_icon_url: undefined },
                footer_navigation: [],
                currency: { code: 'USD', rate_to_idr: 16000 }
            };
        }

        const program = await this.prisma.program.findFirst({ where: { brandId: category.id, isPublished: true, isActive: true }, orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] });
        const settings = await this.prisma.brandSetting.findUnique({
            where: { brandId: category.id }
        });

        const result = {
            maintenance: {
                is_maintenance_mode: settings?.isMaintenanceMode || false,
                message: settings?.maintenanceMessage || undefined,
                scheduled_end: settings?.maintenanceScheduledEnd || undefined
            },
            brand: {
                name: category.name,
                logo_url: category.logoUrl || '',
                logo_white_url: category.logoWhiteUrl || undefined,
                logo_color_url: category.logoColorUrl || undefined,
                logo_icon_url: category.logoIconUrl || undefined,
                primary_color: category.primaryColor || undefined,
                description: category.about || category.description || undefined,
                support_email: settings?.supportEmail || category.contactEmail || undefined,
                google_analytics_id: settings?.googleAnalyticsId || undefined,
                pixel_id: settings?.pixelId || undefined,
                contact_phone: category.contactPhone || undefined,
                contact_whatsapp: category.contactWhatsapp || undefined,
                address: category.contactAddress || undefined,
                social_media: category.socialMediaLinks || undefined
            },
            footer_navigation: (settings?.footerNavigation as any) || [],
            currency: {
                code: category.defaultCurrency || 'USD',
                rate_to_idr: settings?.usdInIdr ? Number(settings.usdInIdr) : 16000
            },
            active_program: program ? { 
                id: program.id, 
                name: program.name, 
                slug: program.slug,
                year: program.year || undefined,
                logo_url: program.logoUrl || undefined,
                logo_white_url: program.logoWhiteUrl || undefined,
                logo_color_url: program.logoColorUrl || undefined,
                logo_icon_url: program.logoIconUrl || undefined
            } : undefined
        };

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

        return result;
    }
}
