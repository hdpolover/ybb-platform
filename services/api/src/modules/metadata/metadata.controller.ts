import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';
import { Public } from '../../shared/decorators/public.decorator';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';

// ISO 3166-1 alpha-2: every country-state-city country code is exactly 2
// letters. Rejecting anything else bounds METADATA_STATES/METADATA_CITIES
// key cardinality to <= 26*26 regardless of what a caller sends, instead of
// one Redis key per distinct raw string (audit M221 — this Redis instance
// also holds the JWT revocation blacklist and throttler counters, so an
// unbounded key space is a flooding/eviction risk, not just wasted memory).
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;
// country-state-city subdivision codes run up to 5 chars (e.g. "UA-40",
// "CDMX"), alphanumeric plus hyphen.
const STATE_CODE_RE = /^[A-Za-z0-9-]{1,5}$/;

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
    if (!COUNTRY_CODE_RE.test(countryCode)) {
      throw new BadRequestException('countryCode must be a 2-letter ISO 3166-1 alpha-2 code.');
    }
    const normalized = countryCode.toUpperCase();

    const cacheKey = CACHE_KEYS.METADATA_STATES(normalized);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getStates(normalized);
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
    if (!COUNTRY_CODE_RE.test(countryCode)) {
      throw new BadRequestException('countryCode must be a 2-letter ISO 3166-1 alpha-2 code.');
    }
    if (stateCode !== undefined && !STATE_CODE_RE.test(stateCode)) {
      throw new BadRequestException('stateCode must be a valid ISO 3166-2 subdivision code.');
    }
    const normalizedCountry = countryCode.toUpperCase();
    const normalizedState = stateCode?.toUpperCase();

    const cacheKey = CACHE_KEYS.METADATA_CITIES(normalizedCountry, normalizedState);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.metadataService.getCities(normalizedCountry, normalizedState);
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DAY);
    return result;
  }

  @Public()
  @Get('timezones')
  @ApiOperation({ summary: 'Get list of timezones' })
  @ApiQuery({ name: 'search', required: false, description: 'Filter timezones by name (e.g., "Jakarta")' })
  @ApiResponse({ status: 200, description: 'Return list of valid timezones' })
  async getTimezones(@Query('search') search?: string) {
    // Audit M221: this used to key the cache on the raw, unbounded `search`
    // string (METADATA_TIMEZONES(search)) — a public endpoint minting one
    // Redis key per distinct query, on the same Redis instance that holds
    // the JWT revocation blacklist. Fix is to make the flooding vector
    // impossible rather than merely smaller: cache ONE unfiltered list under
    // a fixed key and filter in memory per request. No user input ever
    // reaches a cache key here anymore.
    const cacheKey = CACHE_KEYS.METADATA_TIMEZONES();
    let timezones = await this.cacheService.get<string[]>(cacheKey);
    if (!timezones) {
      timezones = await this.metadataService.getTimezones();
      await this.cacheService.set(cacheKey, timezones, CACHE_TTL.DAY);
    }

    if (!search) return timezones;

    const lowerSearch = search.toLowerCase();
    return timezones.filter((tz) => tz.toLowerCase().includes(lowerSearch));
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
