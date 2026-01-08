import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { LandingService } from './landing.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { LandingPageResponseDto } from './dto/landing-page.dto';
import { LandingSettingsResponseDto } from './dto/landing-settings.dto';

@ApiTags('landing')
@Controller('landing')
@ApiHeader({
  name: 'x-brand-domain',
  description: 'Domain of the brand/program category (alternative to url query param)',
  required: false,
})
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get global settings, branding, and navigation' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingSettingsResponseDto })
  async getSettings(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingSettingsResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getSettings(url || brandDomain);
  }

  @Get('home')
  @ApiOperation({ summary: 'Get home page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getHome(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getHome(url || brandDomain);
  }

  @Get('about')
  @ApiOperation({ summary: 'Get about page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getAbout(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getAbout(url || brandDomain);
  }

  @Get('programs')
  @ApiOperation({ summary: 'Get programs listing page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getPrograms(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getPrograms(url || brandDomain);
  }

  @Get('programs/:slug')
  @ApiOperation({ summary: 'Get specific program details page by slug' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  @ApiResponse({ status: 404, description: 'Program not found.' })
  async getProgramDetail(
    @Param('slug') slug: string,
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getProgramDetail(slug, url || brandDomain);
  }

  @Get('partners-sponsors')
  @ApiOperation({ summary: 'Get partners and sponsors page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getPartnersSponsors(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getPartnersSponsors(url || brandDomain);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get announcements page content' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, type: LandingPageResponseDto })
  async getAnnouncements(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getAnnouncements(url || brandDomain);
  }
}
