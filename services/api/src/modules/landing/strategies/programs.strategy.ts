import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';

@Injectable()
export class ProgramsStrategy implements ILandingPageStrategy {
  async getData() {
    return {
      slug: 'programs',
      title: 'Our Programs',
      sections: [
        {
          type: 'hero',
          content: {
            headline: 'Discover Our Programs',
            subheadline: 'Find the perfect program to accelerate your growth.',
          },
        },
        {
          type: 'program_list',
          // Placeholder for now, will eventually fetch all active programs with pagination/filtering
          data: [], 
        },
      ],
    };
  }
}
