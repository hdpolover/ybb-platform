import { Injectable, NotFoundException } from '@nestjs/common';
import { ILandingPageStrategy } from './strategies/landing-page.strategy';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';

@Injectable()
export class LandingService {
  private strategies: Record<string, ILandingPageStrategy> = {};

  constructor(
    private readonly homeStrategy: HomeStrategy,
    private readonly aboutStrategy: AboutStrategy,
    private readonly programsStrategy: ProgramsStrategy,
    private readonly partnersSponsorsStrategy: PartnersSponsorsStrategy,
    private readonly announcementsStrategy: AnnouncementsStrategy,
  ) {
    this.strategies['home'] = this.homeStrategy;
    this.strategies['about'] = this.aboutStrategy;
    this.strategies['programs'] = this.programsStrategy;
    this.strategies['partners-sponsors'] = this.partnersSponsorsStrategy;
    this.strategies['announcements'] = this.announcementsStrategy;
  }

  async getPage(slug: string) {
    const strategy = this.strategies[slug];
    if (!strategy) {
      throw new NotFoundException(`Page with slug '${slug}' not found`);
    }
    return strategy.getData();
  }
}
