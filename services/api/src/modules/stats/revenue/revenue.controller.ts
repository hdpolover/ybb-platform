// src/modules/stats/revenue/revenue.controller.ts
import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../auth/application/decorators/roles.decorator';
import { UserRole } from '../../../core/entities/user.entity';
import { RevenueService } from './revenue.service';
import { resolveRevenueAccessScope } from './utils/revenue-access.util';
import { PlatformRevenueQueryDto, RevenueTransactionsQueryDto } from './dto/revenue-query.dto';
import {
  PlatformRevenueRollupResponseDto,
  ProgramRevenueSummaryResponseDto,
} from './dto/revenue-response.dto';

@ApiTags('Revenue')
@Controller('stats/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class RevenueController {
  constructor(
    private readonly revenueService: RevenueService,
    private readonly readPrisma: PrismaReadService,
  ) {}

  @Get('programs/:programId/revenue')
  @ApiOperation({ summary: 'Get revenue summary for a single program (KPIs, monthly trend, by tier/method)' })
  @ApiResponse({ status: 200, type: ProgramRevenueSummaryResponseDto })
  async getProgramRevenue(
    @Param('programId') programId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ProgramRevenueSummaryResponseDto> {
    const scope = await resolveRevenueAccessScope(this.readPrisma, user);
    return this.revenueService.getProgramRevenueSummary(programId, scope);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get platform-wide revenue rollup (KPIs, monthly trend, by program/brand)' })
  @ApiResponse({ status: 200, type: PlatformRevenueRollupResponseDto })
  async getPlatformRevenue(
    @Query() query: PlatformRevenueQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PlatformRevenueRollupResponseDto> {
    const scope = await resolveRevenueAccessScope(this.readPrisma, user);
    return this.revenueService.getPlatformRevenueRollup(query, scope);
  }

  @Get('revenue/transactions')
  @ApiOperation({ summary: 'Paginated revenue/payment transaction audit list' })
  @ApiResponse({ status: 200, description: 'Paginated invoice rows with gross/fee/net' })
  async getRevenueTransactions(
    @Query() query: RevenueTransactionsQueryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const scope = await resolveRevenueAccessScope(this.readPrisma, user);
    return this.revenueService.getRevenueTransactions(query, scope);
  }

  @Get('revenue/transactions/export')
  @ApiOperation({ summary: 'Export the revenue transaction audit list to Excel (same filters as the list endpoint)' })
  @ApiResponse({ status: 200, description: 'Excel file with revenue transactions' })
  async exportRevenueTransactions(
    @Query() query: RevenueTransactionsQueryDto,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const scope = await resolveRevenueAccessScope(this.readPrisma, user);
    await this.revenueService.exportRevenueTransactions(res, query, scope);
  }
}
