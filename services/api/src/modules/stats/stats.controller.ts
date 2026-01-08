
import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { GetStatsQueryDto } from './dto/get-stats.dto';
import { StatsResponseDto } from './dto/stats-response.dto';

@ApiTags('stats')
@Controller('stats')
@ApiHeader({
  name: 'x-brand-domain',
  description: 'Domain of the brand/program category (alternative to url query param)',
  required: false,
})
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Get unified statistics (Impact, Geography)' })
  @ApiResponse({ status: 200, type: StatsResponseDto })
  async getStats(
    @Query() query: GetStatsQueryDto,
    @Headers() headers?: Record<string, string>,
  ): Promise<StatsResponseDto> {
    const brandDomain = headers?.['x-brand-domain'];
    if (!query.url && brandDomain) {
      query.url = brandDomain;
    }
    return this.statsService.getStats(query);
  }
}
