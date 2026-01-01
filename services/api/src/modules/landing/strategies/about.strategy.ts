import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';

@Injectable()
export class AboutStrategy implements ILandingPageStrategy {
  async getData() {
    // Try to fetch the main program category or brand info if available
    // For now, returning static content structure
    return {
      slug: 'about',
      title: 'About Us',
      sections: [
        {
          type: 'text',
          content: 'Youth Break the Boundaries (YBB) is a foundation that focuses on youth development and empowerment...',
        },
        {
          type: 'vision_mission',
          vision: 'To be the leading platform for global youth collaboration.',
          mission: 'Connecting youth from around the world to solve global challenges.',
        },
      ],
    };
  }
}
