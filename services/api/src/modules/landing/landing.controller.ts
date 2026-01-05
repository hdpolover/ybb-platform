import { Controller, Get, Param } from '@nestjs/common';
import { LandingService } from './landing.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LandingPageResponseDto } from './dto/landing-page.dto';

@ApiTags('landing')
@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get landing page content by slug' })
  @ApiResponse({ 
    status: 200, 
    description: 'Return the page content.',
    type: LandingPageResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Page not found.' })
  async getPage(@Param('slug') slug: string): Promise<LandingPageResponseDto> {
    return this.landingService.getPage(slug);
  }
}
