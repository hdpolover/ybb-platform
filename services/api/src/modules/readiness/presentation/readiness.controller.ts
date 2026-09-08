// services/api/src/modules/readiness/presentation/readiness.controller.ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AdminScopeGuard, ScopedBy } from '@shared/guards/admin-scope.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { GetBrandReadinessQuery } from '../application/queries/get-brand-readiness.query';
import { GetProgramReadinessQuery } from '../application/queries/get-program-readiness.query';
import { GetReadinessSummaryQuery } from '../application/queries/get-readiness-summary.query';
import { CreateReadinessOverrideCommand } from '../application/commands/create-readiness-override.command';
import { ReadinessReportDto } from './dto/readiness-report.dto';
import { CreateOverrideDto } from './dto/create-override.dto';

@ApiTags('Readiness')
@ApiBearerAuth()
@Controller('readiness')
@UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard)
export class ReadinessController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

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

  @Post('overrides')
  @Roles(UserRole.SUPER_ADMIN)
  @ScopedBy('platform')
  @ApiOperation({ summary: 'Override a readiness blocker, with an audited reason' })
  async createOverride(
    @Body() dto: CreateOverrideDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ success: boolean }> {
    await this.commandBus.execute(
      new CreateReadinessOverrideCommand(
        {
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
          ruleId: dto.ruleId,
          reason: dto.reason,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        user.adminId ?? user.userId,
      ),
    );
    return { success: true };
  }
}
