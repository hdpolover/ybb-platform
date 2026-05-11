import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { AuditService } from './audit.service';
import { RmqEventPayload } from '@common/types/events';
import { acknowledgeRmqMessage } from '@shared/infrastructure/rabbitmq/rmq-ack';

// NestJS @EventPattern does literal string match on the deserialized `pattern`
// field — it does NOT expand AMQP wildcards. A previous version of this file
// registered `user.*`, `payment.*`, etc. and matched nothing, causing every
// event in audit_log_queue (bound `#`) to NACK with "An unsupported event was
// received". Enumerate the concrete event names instead.
//
// Keep this list aligned with rabbitmq-producer.service.ts emit() callsites.
// If you add a new event, add a handler here too or audit_log_queue will NACK it.
const AUDITED_EVENTS = [
  // user.* — emitted from auth/register, auth/forgot-password, auth/verify-email
  'user.registered',
  'user.verify-email',
  'user.email-verified',
  'user.forgot-password',
  // payment.* — emitted from Go payment service to ybb.events via the bridge
  'payment.succeeded',
  'payment.created',
  'payment.failed',
  'payment.cancelled',
  'payment.refunded',
  // payment.* — emitted from API service (admin reject, outbox application update)
  'payment.rejected',
  'payment.application-status-updated',
  // support.* — emitted from support ticket workflows
  'support.ticket.created',
  'support.ticket.replied',
  'support.ticket.status-updated',
] as const;

@Controller()
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern('user.registered')
  userRegistered(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('user.verify-email')
  userVerifyEmail(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('user.email-verified')
  userEmailVerified(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('user.forgot-password')
  userForgotPassword(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('payment.succeeded')
  paymentSucceeded(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('payment.created')
  paymentCreated(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('payment.failed')
  paymentFailed(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('payment.cancelled')
  paymentCancelled(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('payment.refunded')
  paymentRefunded(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('support.ticket.created')
  supportTicketCreated(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('support.ticket.replied')
  supportTicketReplied(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('support.ticket.status-updated')
  supportTicketStatusUpdated(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('payment.rejected')
  paymentRejected(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  @EventPattern('payment.application-status-updated')
  paymentApplicationStatusUpdated(@Payload() d: RmqEventPayload, @Ctx() c: RmqContext) { return this.log(d, c); }

  // Catch-all for orphaned/unknown events (old queue messages, stale bindings,
  // legacy publishers without the NestJS envelope). ACK and log a warning so
  // RabbitMQ drops them cleanly instead of bouncing them through the retry queue.
  @EventPattern('__unhandled__')
  unhandledEvent(@Ctx() c: RmqContext) {
    const pattern = c.getPattern();
    this.logger.warn(`[audit] unhandled event received pattern=${pattern} — ACKing to prevent retry loop`);
    acknowledgeRmqMessage(c, this.logger, pattern, 'audit-unhandled');
  }

  private async log(data: RmqEventPayload, context: RmqContext) {
    const pattern = context.getPattern();
    try {
      await this.auditService.logEvent(pattern, data);
    } catch (error) {
      // Never NACK an audit event — losing the audit row is preferable to
      // requeuing forever when the audit table is offline.
      this.logger.error(
        `Failed to persist audit event ${pattern}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      acknowledgeRmqMessage(context, this.logger, pattern, 'audit-processed');
    }
  }
}

export const _auditedEventsForTests = AUDITED_EVENTS;
