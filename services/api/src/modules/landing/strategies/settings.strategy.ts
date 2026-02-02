import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { Brand } from '@prisma/client';
import { LandingSettingsResponseDto } from '../dto/landing-settings.dto';

@Injectable()
export class SettingsStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData(category: Brand | null): Promise<LandingSettingsResponseDto> {
    if (!category) {
        return {
            maintenance: { is_maintenance_mode: false },
            brand: { name: 'Youth Break the Boundaries', logo_url: '' },
            footer_navigation: [],
            currency: { code: 'USD', rate_to_idr: 16000 }
        };
    }

    const settings = await this.prisma.brandSetting.findUnique({
        where: { brandId: category.id }
    });

    return {
        maintenance: {
            is_maintenance_mode: settings?.isMaintenanceMode || false,
            message: settings?.maintenanceMessage || undefined,
            scheduled_end: settings?.maintenanceScheduledEnd || undefined
        },
        brand: {
            name: category.name,
            logo_url: category.logoUrl || '',
            primary_color: category.primaryColor || undefined,
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
        }
    };
  }
}
