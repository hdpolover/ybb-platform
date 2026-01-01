import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';

@Injectable()
export class PartnersSponsorsStrategy implements ILandingPageStrategy {
  async getData() {
    return {
      slug: 'partners-sponsors',
      title: 'Partners & Sponsors',
      sections: [
        {
          type: 'hero',
          content: {
            headline: 'Our Valued Partners',
            subheadline: 'Collaborating to create global impact.',
          },
        },
        {
          type: 'sponsors_grid',
          // Placeholder
          data: [],
        },
        {
          type: 'partners_grid',
          // Placeholder
          data: [],
        },
        {
          type: 'cta_become_partner',
          content: {
            text: 'Interested in partnering with us?',
            link: '/contact',
          },
        },
      ],
    };
  }
}
