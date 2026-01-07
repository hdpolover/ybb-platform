
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { GetStatsQueryDto } from './dto/get-stats.dto';
import { StatsResponseDto } from './dto/stats-response.dto';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Get unified statistics (Impact, Geography)' })
  @ApiResponse({ status: 200, type: StatsResponseDto })
  async getStats(@Query() query: GetStatsQueryDto): Promise<StatsResponseDto> {
    return this.statsService.getStats(query);
  }
}
