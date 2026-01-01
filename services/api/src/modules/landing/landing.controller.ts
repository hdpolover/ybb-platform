import { Controller, Get, Param } from '@nestjs/common';
import { LandingService } from './landing.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Landing')
@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get landing page content by slug' })
  @ApiResponse({ status: 200, description: 'Return the page content.' })
  @ApiResponse({ status: 404, description: 'Page not found.' })
  async getPage(@Param('slug') slug: string) {
    return this.landingService.getPage(slug);
  }
}
