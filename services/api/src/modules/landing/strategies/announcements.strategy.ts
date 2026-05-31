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
    const now = new Date();
    // News is brand-level: show announcements from every program in the brand that is
    // published and visible on the website, including completed/past editions. We gate on
    // isVisibleToUsers (NOT isActive) so past programs — which stop accepting applications
    // and therefore have isActive=false — still surface their news.
    const programWhere = {
      ...(category?.id ? { brandId: category.id } : {}),
      isPublished: true,
      isVisibleToUsers: true,
    };

    const [systemAnnouncements, programAnnouncements] = await Promise.all([
      this.prisma.systemAnnouncement.findMany({
        where: {
          isPublished: true,
          OR: [
            { brandId: category?.id ?? undefined },
            { brandId: null },
          ],
        },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      }),
      this.prisma.programAnnouncement.findMany({
        where: {
          isActive: true,
          publishDate: { lte: now },
          targetAudience: 'all',
          program: programWhere,
        },
        orderBy: [{ isPinned: 'desc' }, { publishDate: 'desc' }],
        take: 50,
        include: {
          program: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      }),
    ]);

    const announcements = [
      ...systemAnnouncements.map((announcement) => {
        const meta = (announcement.metadata as Record<string, unknown>) ?? {};
        const tags = Array.isArray(meta.tags)
          ? meta.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
          : [];

        return {
          id: announcement.id,
          title: announcement.title,
          excerpt: announcement.summary ?? buildRichTextPreview(announcement.content, 160),
          content: announcement.content,
          image: (meta.imageUrl as string) ?? null,
          author: (meta.author as string) ?? null,
          date: announcement.publishedAt,
          href: announcement.actionUrl ?? null,
          category: announcement.type,
          tags,
        };
      }),
      ...programAnnouncements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        excerpt: buildRichTextPreview(announcement.content, 160),
        content: announcement.content,
        image: announcement.imageUrl,
        author: announcement.program.name,
        date: announcement.publishDate,
        href: announcement.program.slug ? `/programs/${announcement.program.slug}` : null,
        category: announcement.category ?? 'general',
        tags: announcement.tags,
      })),
    ]
      .sort((left, right) => {
        const leftTime = left.date ? new Date(left.date).getTime() : 0;
        const rightTime = right.date ? new Date(right.date).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 50);

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
          data: announcements,
        },
      ],
    };
    return result;
  }
}
