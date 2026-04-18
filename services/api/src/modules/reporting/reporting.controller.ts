import { Controller, Logger, Get, Res, UseGuards } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { PaymentSucceededPayload, UserRegisteredPayload } from '@common/types/events';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';

@ApiTags('Reporting')
@Controller('reporting')
export class ReportingController {
  private readonly logger = new Logger(ReportingController.name);

  constructor(private readonly reportingService: ReportingService) { }

  @Get('audit-logs/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export Audit Logs (Admin)', operationId: 'exportAuditLogs' })
  @ApiResponse({ status: 200, description: 'Excel file with audit logs' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  async exportAuditLogs(@Res() res: Response) {
    await this.reportingService.exportAuditLogs(res);
  }

  @Get('users/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export Users List (Admin)', operationId: 'exportUsers' })
  @ApiResponse({ status: 200, description: 'Excel file with users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  async exportUsers(@Res() res: Response) {
    await this.reportingService.exportUsers(res);
  }

  @Get('participants/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export Participants List (Admin)', operationId: 'exportParticipants' })
  @ApiResponse({ status: 200, description: 'Excel file with participants' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  async exportParticipants(@Res() res: Response) {
    await this.reportingService.exportParticipants(res);
  }

  @Get('payments/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export Payments List (Admin)', operationId: 'exportPayments' })
  @ApiResponse({ status: 200, description: 'Excel file with payments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  async exportPayments(@Res() res: Response) {
    await this.reportingService.exportPayments(res);
  }

  @EventPattern('payment.succeeded')
  async handlePaymentSucceeded(@Payload() data: PaymentSucceededPayload, @Ctx() context: RmqContext) {
    this.logger.log(`[Reporting] Processing Payment Succeeded: ${data.amount} ${data.currency}`);
    // Future: this.reportingService.recordRevenue(data);
  }

  @EventPattern('user.registered')
  async handleUserRegistered(@Payload() data: UserRegisteredPayload, @Ctx() context: RmqContext) {
    this.logger.log(`[Reporting] Processing User Registration: ${data.email}`);
    // Future: this.reportingService.recordSignups(data);
  }

  // Add other events as needed
}
