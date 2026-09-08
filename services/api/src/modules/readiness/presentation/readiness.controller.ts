// services/api/src/modules/readiness/presentation/readiness.controller.ts
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AdminScopeGuard, ScopedBy } from '@shared/guards/admin-scope.guard';
import { GetBrandReadinessQuery } from '../application/queries/get-brand-readiness.query';
import { GetProgramReadinessQuery } from '../application/queries/get-program-readiness.query';
import { GetReadinessSummaryQuery } from '../application/queries/get-readiness-summary.query';
import { ReadinessReportDto } from './dto/readiness-report.dto';

@ApiTags('Readiness')
@ApiBearerAuth()
@Controller('readiness')
@UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard)
export class ReadinessController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('brands/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ScopedBy('brand', 'id')
  @ApiOperation({ summary: 'Publish readiness report for a brand' })
  @ApiResponse({ status: 200, description: 'Readiness report for the brand', type: ReadinessReportDto })
  async getBrandReadiness(@Param('id', ParseUUIDPipe) id: string): Promise<ReadinessReportDto> {
    return this.queryBus.execute(new GetBrandReadinessQuery(id));
  }

  @Get('programs/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROGRAM_MANAGER)
  @ScopedBy('program', 'id')
  @ApiOperation({ summary: 'Publish readiness report for a program, including its brand rules' })
  @ApiResponse({ status: 200, description: 'Readiness report for the program', type: ReadinessReportDto })
  async getProgramReadiness(@Param('id', ParseUUIDPipe) id: string): Promise<ReadinessReportDto> {
    return this.queryBus.execute(new GetProgramReadinessQuery(id));
  }

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN)
  @ScopedBy('platform')
  @ApiOperation({ summary: 'Fleet readiness summary, from the latest snapshots' })
  async getSummary() {
    return this.queryBus.execute(new GetReadinessSummaryQuery());
  }
}
