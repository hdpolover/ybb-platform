import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProgramCategory } from '@prisma/client';

@Injectable()
export class AnnouncementsStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData(category: ProgramCategory | null) {
    const announcements = category ? await this.prisma.systemAnnouncement.findMany({
        where: {
            programCategoryId: category.id,
            isPublished: true,
            OR: [
                { targetAudience: 'all' },
                // Add other public audiences if applicable
            ]
        },
        orderBy: { publishedAt: 'desc' },
        take: 10
    }) : [];

    return {
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
  }
}
