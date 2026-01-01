import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';

@Injectable()
export class AnnouncementsStrategy implements ILandingPageStrategy {
  async getData() {
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
          // Placeholder
          data: [],
        },
      ],
    };
  }
}
