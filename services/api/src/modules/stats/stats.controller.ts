
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { GetStatsQueryDto } from './dto/get-stats.dto';
import { StatsResponseDto } from './dto/stats-response.dto';
import { BrandDomain } from '../../shared/decorators/brand-domain.decorator';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';

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

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin platform analytics summary' })
  @ApiQuery({ name: 'brandId', required: false, type: String, description: 'Filter by brand ID (platform admins only)' })
  @ApiResponse({ status: 200, description: 'Admin analytics summary' })
  async getAdminAnalytics(
    @Query('brandId') brandId?: string,
  ) {
    return this.statsService.getAdminAnalytics(brandId);
  }
}
