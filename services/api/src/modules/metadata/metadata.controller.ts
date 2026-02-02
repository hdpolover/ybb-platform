import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('Metadata')
@Controller('metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Public()
  @Get('countries')
  @ApiOperation({ summary: 'Get list of countries' })
  @ApiResponse({ status: 200, description: 'Return list of countries with codes' })
  getCountries() {
    return this.metadataService.getCountries();
  }

  @Public()
  @Get('states/:countryCode')
  @ApiOperation({ summary: 'Get list of states/regions by country code' })
  @ApiParam({ name: 'countryCode', description: 'ISO Country Code (e.g. ID, US)' })
  @ApiResponse({ status: 200, description: 'Return list of states' })
  getStates(@Param('countryCode') countryCode: string) {
    return this.metadataService.getStates(countryCode);
  }

  @Public()
  @Get('cities/:countryCode')
  @ApiOperation({ summary: 'Get list of cities by country code (and optionally state code)' })
  @ApiParam({ name: 'countryCode', description: 'ISO Country Code (e.g. ID, US)' })
  @ApiQuery({ name: 'stateCode', required: false, description: 'ISO State Code' })
  @ApiResponse({ status: 200, description: 'Return list of cities' })
  getCities(
    @Param('countryCode') countryCode: string,
    @Query('stateCode') stateCode?: string,
  ) {
    return this.metadataService.getCities(countryCode, stateCode);
  }

  @Public()
  @Get('timezones')
  @ApiOperation({ summary: 'Get list of timezones' })
  @ApiQuery({ name: 'search', required: false, description: 'Filter timezones by name (e.g., "Jakarta")' })
  @ApiResponse({ status: 200, description: 'Return list of valid timezones' })
  getTimezones(@Query('search') search?: string) {
    return this.metadataService.getTimezones(search);
  }

  @Public()
  @Get('currencies')
  @ApiOperation({ summary: 'Get list of currencies' })
  @ApiResponse({ status: 200, description: 'Return list of currencies' })
  getCurrencies() {
    return this.metadataService.getCurrencies();
  }

  @Public()
  @Get('genders')
  @ApiOperation({ summary: 'Get list of genders' })
  @ApiResponse({ status: 200, description: 'Return list of gender options' })
  getGenders() {
    return this.metadataService.getGenders();
  }

  @Public()
  @Get('application-categories')
  @ApiOperation({ summary: 'Get list of application categories' })
  @ApiResponse({ status: 200, description: 'Return list of application categories' })
  getApplicationCategories() {
    return this.metadataService.getApplicationCategories();
  }

  @Public()
  @Get('shirt-sizes')
  @ApiOperation({ summary: 'Get list of shirt sizes' })
  @ApiResponse({ status: 200, description: 'Return list of shirt sizes' })
  getShirtSizes() {
    return this.metadataService.getShirtSizes();
  }

  @Public()
  @Get('dietary-restrictions')
  @ApiOperation({ summary: 'Get list of dietary restrictions' })
  @ApiResponse({ status: 200, description: 'Return list of dietary restrictions' })
  getDietaryRestrictions() {
    return this.metadataService.getDietaryRestrictions();
  }

  @Public()
  @Get('knowledge-sources')
  @ApiOperation({ summary: 'Get list of knowledge sources' })
  @ApiResponse({ status: 200, description: 'Return list of knowledge sources' })
  getKnowledgeSources() {
    return this.metadataService.getKnowledgeSources();
  }

  @Public()
  @Get('enums')
  @ApiOperation({ summary: 'Get all system enums (statuses, types, etc.)' })
  @ApiResponse({ status: 200, description: 'Return object containing all system enums' })
  getSystemEnums() {
    return this.metadataService.getSystemEnums();
  }
}
