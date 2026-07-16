import { Controller, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QueueMonitoringService } from '../infrastructure/monitoring/queue-monitoring.service';
import { JwtAuthGuard } from '../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '../../modules/auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';

@ApiTags('System')
@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class QueueController {
  constructor(private readonly queueMonitoringService: QueueMonitoringService) {}

  @Delete('purge')
  @ApiOperation({ summary: 'Purge non-critical queues — reporting + notifications (Admin only)' })
  @ApiResponse({ status: 200, description: 'Queues purged' })
  async purgeQueues() {
    const results = await this.queueMonitoringService.purgeQueues();
    const total = results.reduce((sum, r) => sum + r.purged, 0);
    return {
      message: `Purged ${total} message(s) across ${results.length} queue(s)`,
      queues: results,
      timestamp: new Date().toISOString(),
    };
  }
}
