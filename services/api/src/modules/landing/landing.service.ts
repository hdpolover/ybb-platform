import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ILandingPageStrategy } from './strategies/landing-page.strategy';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';
import { ProgramCategory } from '@prisma/client';

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
  ) {}

  private async resolveCategory(url?: string): Promise<ProgramCategory | null> {
    if (!url) {
      // Return default active category if no URL specified, likely the main YBB one
      return this.prisma.programCategory.findFirst({
        where: { isActive: true },
        // Prefer one marked as 'default' if we had such flag, or specific slug
        // For now, any active one or 'ybb' specifically if we wanted to enforce default
        orderBy: { createdAt: 'asc' }
      });
    }

    // Try to find by exact URL match (most reliable)
    let category = await this.prisma.programCategory.findFirst({
      where: { 
        websiteUrl: url,
        isActive: true 
      },
    });

    if (!category) {
      // Try to find if the stored url contains the request url (e.g request: domain.com, stored: https://domain.com)
      category = await this.prisma.programCategory.findFirst({
        where: {
          websiteUrl: { contains: url, mode: 'insensitive' },
          isActive: true
        }
      });
    }

    if (!category) {
      throw new NotFoundException(`No program category found for URL: ${url}`);
    }

    return category;
  }

  async getHome(url?: string) {
    const category = await this.resolveCategory(url);
    return this.homeStrategy.getData(category);
  }

  async getAbout(url?: string) {
    const category = await this.resolveCategory(url);
    return this.aboutStrategy.getData(category);
  }

  async getPrograms(url?: string) {
    const category = await this.resolveCategory(url);
    return this.programsStrategy.getData(category);
  }

  async getProgramDetail(slug: string, url?: string) {
    const category = await this.resolveCategory(url);
    return this.programsStrategy.getProgramData(slug, category);
  }

  async getPartnersSponsors(url?: string) {
    const category = await this.resolveCategory(url);
    return this.partnersSponsorsStrategy.getData(category);
  }

  async getAnnouncements(url?: string) {
    const category = await this.resolveCategory(url);
    return this.announcementsStrategy.getData(category);
  }
}
