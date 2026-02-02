
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { GetStatsQueryDto } from './dto/get-stats.dto';
import { StatsResponseDto } from './dto/stats-response.dto';
import { BrandDomain } from '../../shared/decorators/brand-domain.decorator';

@ApiTags('Stats')
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
    @BrandDomain() brandDomain?: string,
  ): Promise<StatsResponseDto> {
    if (!query.url && brandDomain) {
      query.url = brandDomain;
    }
    return this.statsService.getStats(query);
  }
}
