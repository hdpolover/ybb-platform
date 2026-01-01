import { ApiProperty } from '@nestjs/swagger';

export class LandingPageSectionDto {
  @ApiProperty({ example: 'hero', description: 'The type of the section' })
  type: string;

  @ApiProperty({ 
    example: 'Section Title', 
    description: 'Title of the section', 
    required: false 
  })
  title?: string;

  @ApiProperty({ 
    description: 'Content object for the section (structure depends on type)', 
    required: false,
    type: 'object'
  })
  content?: any;

  @ApiProperty({ 
    description: 'Data array for the section (e.g., list of programs)', 
    required: false,
    isArray: true,
    type: 'object'
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
