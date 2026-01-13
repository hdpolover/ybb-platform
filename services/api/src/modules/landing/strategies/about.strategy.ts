import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProgramCategory } from '@prisma/client';

@Injectable()
export class AboutStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData(category: ProgramCategory | null) {
    const name = category?.name || 'Youth Break the Boundaries';
    const about = category?.about || 'Youth Break the Boundaries (YBB) is a foundation that focuses on youth development and empowerment...';
    const vision = category?.vision || 'To be the leading platform for global youth collaboration.';
    const mission = category?.mission || 'Connecting youth from around the world to solve global challenges.';

    return {
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
  }
}
