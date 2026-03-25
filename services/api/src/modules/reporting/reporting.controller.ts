import { Controller, Logger, Get, Res, UseGuards } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { PaymentSucceededPayload, UserRegisteredPayload } from '@common/types/events';
// import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
// import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Reporting')
@Controller('reporting')
export class ReportingController {
  private readonly logger = new Logger(ReportingController.name);

  constructor(private readonly reportingService: ReportingService) { }

  @Get('audit-logs/export')
  @ApiOperation({ summary: 'Export Audit Logs (Admin)', operationId: 'exportAuditLogs' })
  @ApiResponse({ status: 200, description: 'Excel file with audit logs' })
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN') 
  async exportAuditLogs(@Res() res: Response) {
    await this.reportingService.exportAuditLogs(res);
  }

  @Get('users/export')
  @ApiOperation({ summary: 'Export Users List (Admin)', operationId: 'exportUsers' })
  @ApiResponse({ status: 200, description: 'Excel file with users' })
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN')
  async exportUsers(@Res() res: Response) {
    await this.reportingService.exportUsers(res);
  }

  @Get('participants/export')
  @ApiOperation({ summary: 'Export Participants List (Admin)', operationId: 'exportParticipants' })
  @ApiResponse({ status: 200, description: 'Excel file with participants' })
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN')
  async exportParticipants(@Res() res: Response) {
    await this.reportingService.exportParticipants(res);
  }

  @Get('payments/export')
  @ApiOperation({ summary: 'Export Payments List (Admin)', operationId: 'exportPayments' })
  @ApiResponse({ status: 200, description: 'Excel file with payments' })
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN')
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
