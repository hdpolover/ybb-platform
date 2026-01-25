import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { LandingService } from './landing.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiHeader, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { LandingPageResponseDto } from './dto/landing-page.dto';
import { LandingSettingsResponseDto } from './dto/landing-settings.dto';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('landing')
@Controller('landing')
@Public()
@ApiHeader({
  name: 'x-brand-domain',
  description: 'Domain of the brand/program category (e.g., istanyouthsummit.com). This is an alternative to the "url" query parameter for multi-tenancy resolution.',
  required: false,
})
@ApiResponse({ status: 500, description: 'Internal server error' })
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get('settings')
  @ApiOperation({ 
    summary: 'Get global settings', 
    description: 'Retrieves brand-specific settings, branding (logo, colors), properties, and navigation data.' 
  })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL for resolution (optional if x-brand-domain header is used)' })
  @ApiResponse({ status: 200, description: 'Return settings object', type: LandingSettingsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
  async getSettings(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingSettingsResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getSettings(url || brandDomain);
  }

  @Get('home')
  @ApiOperation({ 
    summary: 'Get home page content', 
    description: 'Retrieves the structure and content for the home page, including sections like Hero, About, Programs, etc.' 
  })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, description: 'Return home page structure', type: LandingPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
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
  @ApiResponse({ status: 200, description: 'Return about page structure', type: LandingPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
  async getAbout(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getAbout(url || brandDomain);
  }

  @Get('programs')
  @ApiOperation({ summary: 'Get programs listing page' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, description: 'Return programs listing structure', type: LandingPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
  async getPrograms(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getPrograms(url || brandDomain);
  }

  @Get('programs/:slug')
  @ApiOperation({ summary: 'Get specific program details' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, description: 'Return program details structure', type: LandingPageResponseDto })
  @ApiNotFoundResponse({ description: 'Program not found' })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
  async getProgramDetail(
    @Param('slug') slug: string,
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getProgramDetail(slug, url || brandDomain);
  }

  @Get('partners-sponsors')
  @ApiOperation({ summary: 'Get partners and sponsors page' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, description: 'Return partners page structure', type: LandingPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
  async getPartnersSponsors(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getPartnersSponsors(url || brandDomain);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get announcements page' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiResponse({ status: 200, description: 'Return announcements page structure', type: LandingPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
  async getAnnouncements(
    @Query('url') url?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getAnnouncements(url || brandDomain);
  }

  @Get('faqs')
  @ApiOperation({ summary: 'Get FAQs page' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiResponse({ status: 200, description: 'Return FAQs page structure', type: LandingPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid brand identification' })
  async getFaqs(
    @Query('url') url?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Headers() headers?: Record<string, string>,
  ): Promise<LandingPageResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    return this.landingService.getFaqs(url || brandDomain, page, limit, search);
  }
}
