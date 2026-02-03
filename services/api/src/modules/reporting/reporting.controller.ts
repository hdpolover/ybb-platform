import { Controller, Logger, Get, Res, UseGuards } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
// import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
// import { Roles } from '../common/decorators/roles.decorator';

@Controller('reporting')
export class ReportingController {
  private readonly logger = new Logger(ReportingController.name);

  constructor(private readonly reportingService: ReportingService) {}

  @Get('audit-logs/export')
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN') 
  async exportAuditLogs(@Res() res: Response) {
      await this.reportingService.exportAuditLogs(res);
  }

  @Get('users/export')
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN')
  async exportUsers(@Res() res: Response) {
      await this.reportingService.exportUsers(res);
  }

  @Get('participants/export')
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN')
  async exportParticipants(@Res() res: Response) {
      await this.reportingService.exportParticipants(res);
  }

  @Get('payments/export')
  // @UseGuards(JwtAuthGuard)
  // @Roles('ADMIN')
  async exportPayments(@Res() res: Response) {
      await this.reportingService.exportPayments(res);
  }

  @EventPattern('payment.succeeded')
  async handlePaymentSucceeded(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log(`[Reporting] Processing Payment Succeeded: ${data.amount} ${data.currency}`);
    // Future: this.reportingService.recordRevenue(data);
  }

  @EventPattern('user.registered')
  async handleUserRegistered(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log(`[Reporting] Processing User Registration: ${data.email}`);
     // Future: this.reportingService.recordSignups(data);
  }
  
  // Add other events as needed
}
