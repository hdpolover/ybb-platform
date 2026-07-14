import { Controller, Logger, Get, Res, Query, UseGuards } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { InvoiceFilterQuery } from '@modules/payments/application/services/invoice-where.builder';
import { PaymentSucceededPayload, UserRegisteredPayload } from '@common/types/events';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';
import { acknowledgeRmqMessage } from '@shared/infrastructure/rabbitmq/rmq-ack';

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
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  // Query params mirror PaymentAdminController.listInvoices exactly — both
  // endpoints build their `where` clause via the same buildInvoiceWhere()
  // (see invoice-where.builder.ts) so the exported rows always match the
  // admin payments table for the same filter set.
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'paymentMethod', required: false })
  @ApiQuery({ name: 'tierId', required: false })
  @ApiQuery({ name: 'feeType', required: false })
  @ApiQuery({ name: 'applicationStatus', required: false })
  @ApiQuery({ name: 'followUpStatus', required: false })
  @ApiQuery({ name: 'payerType', required: false })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'paidFrom', required: false })
  @ApiQuery({ name: 'paidTo', required: false })
  @ApiQuery({ name: 'minAmount', required: false })
  @ApiQuery({ name: 'maxAmount', required: false })
  async exportPayments(
    @Res() res: Response,
    @Query() query: Record<string, string>,
  ) {
    const filters: InvoiceFilterQuery = {
      programId: query.programId,
      status: query.status,
      search: query.search,
      paymentMethod: query.paymentMethod,
      tierId: query.tierId,
      feeType: query.feeType,
      applicationStatus: query.applicationStatus,
      followUpStatus: query.followUpStatus,
      payerType: query.payerType,
      currency: query.currency,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      paidFrom: query.paidFrom,
      paidTo: query.paidTo,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
    };
    await this.reportingService.exportPayments(res, filters);
  }

  @EventPattern('payment.succeeded')
  async handlePaymentSucceeded(@Payload() data: PaymentSucceededPayload, @Ctx() context: RmqContext) {
    this.logger.log(`[Reporting] Processing Payment Succeeded: ${data.amount} ${data.currency}`);
    // Future: this.reportingService.recordRevenue(data);
    this.ack(context);
  }

  @EventPattern('user.registered')
  async handleUserRegistered(@Payload() data: UserRegisteredPayload, @Ctx() context: RmqContext) {
    this.logger.log(`[Reporting] Processing User Registration: ${data.email}`);
    // Future: this.reportingService.recordSignups(data);
    this.ack(context);
  }

  // ── No-op acks ─────────────────────────────────────────────────────────────
  // reporting_queue is bound to `#` so it receives every event on ybb.events.
  // NestJS NACKs anything without an exact-match @EventPattern handler, which
  // floods logs with "An unsupported event was received". These handlers are
  // intentional no-ops — they just ACK the message so RabbitMQ drops it cleanly.
  // Remove an entry once reporting actually needs to consume that event.

  @EventPattern('user.verify-email')
  ackUserVerifyEmail(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('user.email-verified')
  ackUserEmailVerified(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('user.forgot-password')
  ackUserForgotPassword(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('payment.created')
  ackPaymentCreated(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('payment.failed')
  ackPaymentFailed(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('payment.cancelled')
  ackPaymentCancelled(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('payment.refunded')
  ackPaymentRefunded(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('support.ticket.created')
  ackSupportTicketCreated(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('support.ticket.replied')
  ackSupportTicketReplied(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('support.ticket.status-updated')
  ackSupportTicketStatusUpdated(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('payment.rejected')
  ackPaymentRejected(@Ctx() context: RmqContext) { this.ack(context); }

  @EventPattern('payment.application-status-updated')
  ackPaymentApplicationStatusUpdated(@Ctx() context: RmqContext) { this.ack(context); }

  // No __unhandled__ handler here on purpose. NestJS dispatches every
  // @EventPattern('__unhandled__') handler in the whole app for any unhandled
  // message, regardless of which queue/microservice it arrived on. Registering
  // it in two places (here AND AuditController) made the same delivery get
  // ACKed twice on the same channel — the broker then returned 406
  // PRECONDITION_FAILED on Basic.Ack and closed the channel. The single
  // catch-all on AuditController services both queues.

  private ack(context: RmqContext) {
    acknowledgeRmqMessage(context, this.logger, context.getPattern(), 'reporting-processed');
  }
}
