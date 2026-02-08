import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';
import { Public } from '../../shared/decorators/public.decorator';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';

@ApiTags('Metadata')
@Controller('metadata')
export class MetadataController {
  constructor(
    private readonly metadataService: MetadataService,
    private readonly cacheService: CacheService,
  ) { }

  @Public()
  @Get('countries')
  @ApiOperation({ summary: 'Get list of countries' })
  @ApiResponse({ status: 200, description: 'Return list of countries with codes' })
  async getCountries() {
    const cacheKey = CACHE_KEYS.METADATA_COUNTRIES;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getCountries();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('states/:countryCode')
  @ApiOperation({ summary: 'Get list of states/regions by country code' })
  @ApiParam({ name: 'countryCode', description: 'ISO Country Code (e.g. ID, US)' })
  @ApiResponse({ status: 200, description: 'Return list of states' })
  async getStates(@Param('countryCode') countryCode: string) {
    const cacheKey = CACHE_KEYS.METADATA_STATES(countryCode);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getStates(countryCode);
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('cities/:countryCode')
  @ApiOperation({ summary: 'Get list of cities by country code (and optionally state code)' })
  @ApiParam({ name: 'countryCode', description: 'ISO Country Code (e.g. ID, US)' })
  @ApiQuery({ name: 'stateCode', required: false, description: 'ISO State Code' })
  @ApiResponse({ status: 200, description: 'Return list of cities' })
  async getCities(
    @Param('countryCode') countryCode: string,
    @Query('stateCode') stateCode?: string,
  ) {
    const cacheKey = CACHE_KEYS.METADATA_CITIES(countryCode, stateCode);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getCities(countryCode, stateCode);
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('timezones')
  @ApiOperation({ summary: 'Get list of timezones' })
  @ApiQuery({ name: 'search', required: false, description: 'Filter timezones by name (e.g., "Jakarta")' })
  @ApiResponse({ status: 200, description: 'Return list of valid timezones' })
  async getTimezones(@Query('search') search?: string) {
    const cacheKey = CACHE_KEYS.METADATA_TIMEZONES(search);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getTimezones(search);
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('currencies')
  @ApiOperation({ summary: 'Get list of currencies' })
  @ApiResponse({ status: 200, description: 'Return list of currencies' })
  async getCurrencies() {
    const cacheKey = CACHE_KEYS.METADATA_CURRENCIES;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getCurrencies();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('genders')
  @ApiOperation({ summary: 'Get list of genders' })
  @ApiResponse({ status: 200, description: 'Return list of gender options' })
  async getGenders() {
    const cacheKey = CACHE_KEYS.METADATA_GENDERS;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getGenders();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('application-categories')
  @ApiOperation({ summary: 'Get list of application categories' })
  @ApiResponse({ status: 200, description: 'Return list of application categories' })
  async getApplicationCategories() {
    const cacheKey = CACHE_KEYS.METADATA_APP_CATEGORIES;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getApplicationCategories();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('shirt-sizes')
  @ApiOperation({ summary: 'Get list of shirt sizes' })
  @ApiResponse({ status: 200, description: 'Return list of shirt sizes' })
  async getShirtSizes() {
    const cacheKey = CACHE_KEYS.METADATA_SHIRT_SIZES;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getShirtSizes();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('dietary-restrictions')
  @ApiOperation({ summary: 'Get list of dietary restrictions' })
  @ApiResponse({ status: 200, description: 'Return list of dietary restrictions' })
  async getDietaryRestrictions() {
    const cacheKey = CACHE_KEYS.METADATA_DIETARY;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getDietaryRestrictions();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('knowledge-sources')
  @ApiOperation({ summary: 'Get list of knowledge sources' })
  @ApiResponse({ status: 200, description: 'Return list of knowledge sources' })
  async getKnowledgeSources() {
    const cacheKey = CACHE_KEYS.METADATA_KNOWLEDGE_SOURCES;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getKnowledgeSources();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('enums')
  @ApiOperation({ summary: 'Get all system enums (statuses, types, etc.)' })
  @ApiResponse({ status: 200, description: 'Return object containing all system enums' })
  async getSystemEnums() {
    const cacheKey = CACHE_KEYS.METADATA_ENUMS;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getSystemEnums();
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }
}
