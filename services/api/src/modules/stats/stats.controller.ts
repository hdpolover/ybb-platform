
import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { ParticipantAnalyticsService } from './participant-analytics.service';
import { GetStatsQueryDto } from './dto/get-stats.dto';
import { StatsResponseDto } from './dto/stats-response.dto';
import { BrandDomain } from '../../shared/decorators/brand-domain.decorator';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';
import { ProgramDashboardResponseDto } from './dto/program-dashboard-response.dto';
import { ProgramAnalyticsResponseDto } from './dto/program-analytics-response.dto';

@ApiTags('Stats')
@Controller('stats')
@ApiHeader({
  name: 'x-brand-domain',
  description: 'Domain of the brand/program category (alternative to url query param)',
  required: false,
})
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly participantAnalyticsService: ParticipantAnalyticsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300')
  @Header('Vary', 'x-brand-domain')
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

  @Get('admin/programs/:programId/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin program dashboard analytics' })
  @ApiResponse({ status: 200, type: ProgramDashboardResponseDto })
  async getAdminProgramDashboard(
    @Param('programId') programId: string,
  ): Promise<ProgramDashboardResponseDto> {
    return this.statsService.getAdminProgramDashboard(programId);
  }

  @Get('admin/programs/:programId/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed program analytics (participants + payments)' })
  @ApiResponse({ status: 200, type: ProgramAnalyticsResponseDto })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'payDateFrom', required: false, type: String })
  @ApiQuery({ name: 'payDateTo', required: false, type: String })
  @ApiQuery({ name: 'appStatuses', required: false, type: String, description: 'Comma-separated application statuses' })
  @ApiQuery({ name: 'appCategory', required: false, type: String })
  @ApiQuery({ name: 'paymentStatuses', required: false, type: String, description: 'Comma-separated: paid,processing,unpaid,failed' })
  @ApiQuery({ name: 'currency', required: false, type: String, description: 'IDR or USD' })
  async getAdminProgramAnalytics(
    @Param('programId') programId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('payDateFrom') payDateFrom?: string,
    @Query('payDateTo') payDateTo?: string,
    @Query('appStatuses') appStatuses?: string,
    @Query('appCategory') appCategory?: string,
    @Query('paymentStatuses') paymentStatuses?: string,
    @Query('currency') currency?: string,
  ): Promise<ProgramAnalyticsResponseDto> {
    return this.statsService.getAdminProgramAnalytics(programId, {
      dateFrom,
      dateTo,
      payDateFrom,
      payDateTo,
      appStatuses: appStatuses ? appStatuses.split(',').filter(Boolean) : undefined,
      appCategory: appCategory || undefined,
      paymentStatuses: paymentStatuses ? paymentStatuses.split(',').filter(Boolean) : undefined,
      currency: currency || undefined,
    });
  }

  // ── Participant Analytics ─────────────────────────────────────────────────

  @Get('admin/programs/:programId/analytics/knowledge-source')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get knowledge source (discovery channel) analytics for a program' })
  @ApiResponse({ status: 200, description: 'Knowledge source distribution and cross-tab' })
  async getKnowledgeSourceAnalytics(@Param('programId') programId: string) {
    return this.participantAnalyticsService.getKnowledgeSourceAnalytics(programId);
  }

  @Get('admin/programs/:programId/analytics/nationality')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get nationality analytics for a program' })
  @ApiResponse({ status: 200, description: 'Nationality distribution and cross-tab' })
  async getNationalityAnalytics(@Param('programId') programId: string) {
    return this.participantAnalyticsService.getNationalityAnalytics(programId);
  }

  @Get('admin/programs/:programId/analytics/gender')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get gender analytics for a program' })
  @ApiResponse({ status: 200, description: 'Gender distribution and cross-tab' })
  async getGenderAnalytics(@Param('programId') programId: string) {
    return this.participantAnalyticsService.getGenderAnalytics(programId);
  }

  @Get('admin/programs/:programId/analytics/age')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get age band analytics for a program' })
  @ApiResponse({ status: 200, description: 'Age distribution and cross-tab' })
  async getAgeAnalytics(@Param('programId') programId: string) {
    return this.participantAnalyticsService.getAgeAnalytics(programId);
  }

  @Get('admin/programs/:programId/analytics/registrations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get registration trend analytics for a program' })
  @ApiResponse({ status: 200, description: 'Daily/monthly trend, by country, by source' })
  async getRegistrationsAnalytics(@Param('programId') programId: string) {
    return this.participantAnalyticsService.getRegistrationsAnalytics(programId);
  }

  @Get('admin/programs/:programId/analytics/ambassadors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ambassador performance analytics for a program' })
  @ApiResponse({ status: 200, description: 'Ambassador leaderboard and referral summary' })
  async getAmbassadorsAnalytics(@Param('programId') programId: string) {
    return this.participantAnalyticsService.getAmbassadorsAnalytics(programId);
  }
}
