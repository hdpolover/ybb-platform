import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ILandingPageStrategy } from './strategies/landing-page.strategy';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';
import { SettingsStrategy } from './strategies/settings.strategy';
import { FaqsStrategy } from './strategies/faqs.strategy';
import { Brand } from '@prisma/client';

@Injectable()
export class LandingService {
  private strategies: Record<string, ILandingPageStrategy> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly homeStrategy: HomeStrategy,
    private readonly aboutStrategy: AboutStrategy,
    private readonly programsStrategy: ProgramsStrategy,
    private readonly partnersSponsorsStrategy: PartnersSponsorsStrategy,
    private readonly announcementsStrategy: AnnouncementsStrategy,
    private readonly settingsStrategy: SettingsStrategy,
    private readonly faqsStrategy: FaqsStrategy,
  ) { }

  private async resolveBrand(url?: string): Promise<Brand | null> {
    if (!url) {
      // Return default active brand if no URL specified, likely the main YBB one
      return this.prisma.brand.findFirst({
        where: { isActive: true },
        // Prefer one marked as 'default' if we had such flag, or specific slug
        // For now, any active one or 'ybb' specifically if we wanted to enforce default
        orderBy: { createdAt: 'asc' }
      });
    }

    // Check if input is UUID (Brand ID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url);
    if (isUuid) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: url, isActive: true }
      });
      if (brand) return brand;
    }

    // Try to find by exact URL match (most reliable)
    let brand = await this.prisma.brand.findFirst({
      where: {
        websiteUrl: url,
        isActive: true
      },
    });

    if (!brand) {
      // Try to find if the stored url contains the request url (e.g request: domain.com, stored: https://domain.com)
      brand = await this.prisma.brand.findFirst({
        where: {
          websiteUrl: { contains: url, mode: 'insensitive' },
          isActive: true
        }
      });
    }

    if (!brand) {
      throw new NotFoundException(`No brand found for URL: ${url}`);
    }

    return brand;
  }

  async getHome(url?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    return this.homeStrategy.getData(brand);
  }

  async getAbout(url?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    return this.aboutStrategy.getData(brand);
  }

  async getPrograms(url?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    return this.programsStrategy.getData(brand);
  }

  async getProgramDetail(slug: string, url?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    return this.programsStrategy.getProgramData(slug, brand);
  }

  async getPartnersSponsors(url?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    return this.partnersSponsorsStrategy.getData(brand);
  }

  async getAnnouncements(url?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    return this.announcementsStrategy.getData(brand);
  }

  async getFaqs(url?: string, page: number = 1, limit: number = 10, search?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    // FaqsStrategy has a specific getFaqs method with pagination
    return this.faqsStrategy.getFaqs(brand, page, limit, search);
  }

  async getSettings(url?: string): Promise<any> {
    const brand = await this.resolveBrand(url);
    return this.settingsStrategy.getData(brand);
  }
}
