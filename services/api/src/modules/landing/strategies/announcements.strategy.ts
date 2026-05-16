import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';
import { LandingSnapshotService } from '../services/landing-snapshot.service';
import { buildRichTextPreview } from '@shared/utils/rich-text';

@Injectable()
export class AnnouncementsStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly landingSnapshotService: LandingSnapshotService,
  ) { }

  async getData(category: Brand | null) {
    if (category) {
      return this.landingSnapshotService.getOrBuildAnnouncementsSnapshot(
        category,
        () => this.buildAnnouncementsPayload(category),
      );
    }

    // Check cache first
    const cacheKey = CACHE_KEYS.LANDING_ANNOUNCEMENTS('default');
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.buildAnnouncementsPayload(category);

    // Cache for 15 minutes (announcements change more frequently)
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);

    return result;
  }

  private async buildAnnouncementsPayload(category: Brand | null) {

    const announcements = await this.prisma.systemAnnouncement.findMany({
      where: {
        isPublished: true,
        OR: [
          { brandId: category?.id ?? undefined },
          { brandId: null },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });

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
          data: announcements.map(a => {
            const meta = (a.metadata as Record<string, unknown>) ?? {};
            const tags = Array.isArray(meta.tags)
              ? meta.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
              : [];
            return {
              id: a.id,
              title: a.title,
              excerpt: a.summary ?? buildRichTextPreview(a.content, 160),
              content: a.content,
              image: (meta.imageUrl as string) ?? null,
              author: (meta.author as string) ?? null,
              date: a.publishedAt,
              href: a.actionUrl ?? null,
              category: a.type,
              tags,
            };
          }),
        },
      ],
    };
    return result;
  }
}
