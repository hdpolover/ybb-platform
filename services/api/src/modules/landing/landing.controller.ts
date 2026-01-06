import { Controller, Get, Param, Query } from '@nestjs/common';
import { LandingService } from './landing.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LandingPageResponseDto } from './dto/landing-page.dto';

@ApiTags('landing')
@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get('home')
  @ApiOperation({ summary: 'Get home page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getHome(@Query('url') url?: string): Promise<LandingPageResponseDto> {
    return this.landingService.getHome(url);
  }

  @Get('about')
  @ApiOperation({ summary: 'Get about page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getAbout(@Query('url') url?: string): Promise<LandingPageResponseDto> {
    return this.landingService.getAbout(url);
  }

  @Get('programs')
  @ApiOperation({ summary: 'Get programs listing page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getPrograms(@Query('url') url?: string): Promise<LandingPageResponseDto> {
    return this.landingService.getPrograms(url);
  }

  @Get('programs/:slug')
  @ApiOperation({ summary: 'Get specific program details page by slug' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  @ApiResponse({ status: 404, description: 'Program not found.' })
  async getProgramDetail(@Param('slug') slug: string, @Query('url') url?: string): Promise<LandingPageResponseDto> {
    return this.landingService.getProgramDetail(slug, url);
  }

  @Get('partners-sponsors')
  @ApiOperation({ summary: 'Get partners and sponsors page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getPartnersSponsors(@Query('url') url?: string): Promise<LandingPageResponseDto> {
    return this.landingService.getPartnersSponsors(url);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get announcements page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getAnnouncements(@Query('url') url?: string): Promise<LandingPageResponseDto> {
    return this.landingService.getAnnouncements(url);
  }
}
