import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';
import { LandingSnapshotService } from '../services/landing-snapshot.service';

@Injectable()
export class AboutStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly landingSnapshotService: LandingSnapshotService,
  ) { }

  async getData(category: Brand | null) {
    if (category) {
      return this.landingSnapshotService.getOrBuildAboutSnapshot(
        category,
        () => this.buildAboutPayload(category),
      );
    }

    // Check cache first
    const cacheKey = CACHE_KEYS.LANDING_ABOUT('default');
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.buildAboutPayload(category);

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

    return result;
  }

  private async buildAboutPayload(category: Brand | null) {

    const name = category?.name || 'Youth Break the Boundaries';
    const about = category?.about || 'Youth Break the Boundaries (YBB) is a foundation that focuses on youth development and empowerment...';
    const vision = category?.vision || 'To be the leading platform for global youth collaboration.';
    const mission = category?.mission || 'Connecting youth from around the world to solve global challenges.';

    const result = {
      slug: 'about',
      title: 'About Us',
      sections: [
        {
          type: 'hero',
          content: {
            title: `About ${name}`,
            image: category?.bannerUrl,
          }
        },
        {
          type: 'text',
          content: {
            description: about,
          },
        },
        {
          type: 'vision_mission',
          content: {
            vision: vision,
            mission: mission,
          },
        },
      ],
    };
    return result;
  }
}
