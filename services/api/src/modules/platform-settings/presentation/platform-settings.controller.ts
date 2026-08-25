// services/api/src/modules/platform-settings/presentation/platform-settings.controller.ts
import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { ImpactStatsService } from '../application/services/impact-stats.service';
import { ImpactStatsDto } from '../application/dto/impact-stats.dto';

// This codebase has no shared AuthenticatedRequest type — every controller
// declares its own local copy (confirmed across programs.controller.ts,
// program-announcements.controller.ts, program-application.controller.ts,
// etc.). Matching that convention here rather than introducing a shared one.
interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; userId: string; email: string; brandId: string };
}

@ApiTags('Platform Settings')
@ApiBearerAuth()
@Controller('platform-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PlatformSettingsController {
  constructor(private readonly impactStatsService: ImpactStatsService) {}

  @Get('impact-stats')
  @ApiOperation({ summary: 'Get organisation-wide impact stats (total alumni, editions, countries, participants)' })
  async getImpactStats() {
    return this.impactStatsService.get();
  }

  @Put('impact-stats')
  @ApiOperation({ summary: 'Update organisation-wide impact stats' })
  async updateImpactStats(@Body() dto: ImpactStatsDto, @Request() req: AuthenticatedRequest) {
    return this.impactStatsService.update(dto, req.user.id);
  }
}
