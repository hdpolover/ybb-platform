import { ApiProperty, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

export class LandingPageSectionContentDto {
  @ApiProperty({ description: 'Main heading', example: 'Welcome to YBB', required: false })
  headline?: string;

  @ApiProperty({ description: 'Sub heading or description', example: 'Empowering youth worldwide.', required: false })
  subheadline?: string;

  @ApiProperty({ description: 'Call to action text', example: 'Join Now', required: false })
  ctaText?: string;

  @ApiProperty({ description: 'Call to action URL', example: '/register', required: false })
  ctaUrl?: string;

  @ApiProperty({ description: 'Image URL', example: 'https://example.com/banner.jpg', required: false })
  image?: string;
  
  @ApiProperty({ description: 'Video URL', example: 'https://youtube.com/...', required: false })
  video?: string;

  // Additional fields for complex sections
  @ApiProperty({ example: 'Some text about us', required: false })
  about_us?: string;

  @ApiProperty({ example: { vision: '...', mission: '...' }, required: false })
  vision_mission?: any;

  @ApiProperty({ description: 'Instagram feed items', required: false, isArray: true, example: [{ id: '...', imageUrl: '...' }] })
  ig_feed?: any[];

  @ApiProperty({ description: 'Registration types/tiers', required: false, isArray: true })
  registration_types?: any[];

  @ApiProperty({ description: 'Guidelines or resources', required: false, isArray: true })
  guidelines?: any[];

  @ApiProperty({ description: 'Tabs for video content', required: false, isArray: true })
  tabs?: any[];

  @ApiProperty({ description: 'List of items (e.g., testimonials, awards)', required: false, isArray: true })
  items?: any[];
}

export class LandingPageSectionDto {
  @ApiProperty({ example: 'hero', description: 'The type of the section (hero, about, programs, stats, faq, contact, etc.)' })
  type: string;

  @ApiProperty({ 
    example: 'Section Title', 
    description: 'Title of the section', 
    required: false 
  })
  title?: string;

  @ApiProperty({ 
    description: 'Content object for the section', 
    required: false,
    type: LandingPageSectionContentDto
  })
  content?: LandingPageSectionContentDto;

  @ApiProperty({ 
    description: 'Data array for the section (e.g., list of programs, testimonials, faqs)', 
    required: false,
    isArray: true,
    example: [
      { id: '1', title: 'Program A', description: '...' },
      { id: '2', title: 'Program B', description: '...' }
    ]
  })
  data?: any[];
}

export class LandingPageResponseDto {
  @ApiProperty({ example: 'home', description: 'The slug of the page' })
  slug: string;

  @ApiProperty({ example: 'Welcome to YBB', description: 'The title of the page' })
  title: string;

  @ApiProperty({ type: [LandingPageSectionDto], description: 'List of sections on the page' })
  sections: LandingPageSectionDto[];
}
