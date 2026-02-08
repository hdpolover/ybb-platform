import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';

@Injectable()
export class AnnouncementsStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) { }

  async getData(category: Brand | null) {
    // Check cache first
    const cacheKey = CACHE_KEYS.LANDING_ANNOUNCEMENTS(category?.id || 'default');
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const announcements = category ? await this.prisma.systemAnnouncement.findMany({
      where: {
        brandId: category.id,
        isPublished: true,
        OR: [
          { targetAudience: 'all' },
          // Add other public audiences if applicable
        ]
      },
      orderBy: { publishedAt: 'desc' },
      take: 10
    }) : [];

    const result = {
      slug: 'announcements',
      title: 'Announcements',
      sections: [
        {
          type: 'hero',
          content: {
            headline: 'Latest News & Updates',
            subheadline: 'Stay informed about our latest activities and opportunities.',
          },
        },
        {
          type: 'announcement_list',
          data: announcements.map(a => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            date: a.publishedAt,
            type: a.type,
            url: a.actionUrl
          })),
        },
      ],
    };

    // Cache for 15 minutes (announcements change more frequently)
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);

    return result;
  }
}
