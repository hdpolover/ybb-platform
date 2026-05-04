import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { EmailService } from '../email/email.service';
import { ReceiptService } from '../email/receipt.service';
import {
  maskEmail,
  summarizeEventPayload,
} from '../../common/logging/safe-log';
import { NotificationIdempotencyService } from './notification-idempotency.service';

type EventPayload = Record<string, unknown>;
type ReceiptItem = { name: string; quantity: number; price: number };

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly receiptService: ReceiptService,
    private readonly idempotencyService: NotificationIdempotencyService,
  ) {}

  @EventPattern('payment.succeeded')
  async handlePaymentSucceeded(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('payment.succeeded', payload, context))) return;

    this.logger.log(
      `Received payment.succeeded event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) return;

    const metadata = asRecord(payload.metadata);
    const items = getReceiptItems(metadata, 'item_details');
    const description =
      getString(metadata, 'description') || 'Payment for services';
    const customerName =
      getString(metadata, 'customer_name') ||
      getString(payload, 'customer_name') ||
      'Customer';
    const orderId =
      getString(payload, 'order_id') ||
      getString(payload, 'payment_id') ||
      'unknown-order';
    const amount = getNumber(payload, 'amount');
    const currency = getString(payload, 'currency') || 'IDR';

    let receiptBuffer: Buffer | undefined;
    try {
      receiptBuffer = await this.receiptService.generateReceipt({
        orderId,
        amount,
        currency,
        customerName,
        date: new Date().toLocaleDateString(),
        description,
        items,
      });
    } catch (error) {
      this.logger.error(
        'Failed to generate receipt',
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.emailService.sendPaymentSuccessEmail(
      email,
      {
        name: customerName,
        amount,
        currency,
        orderId,
        description,
        invoiceUrl: '#',
        items,
      },
      receiptBuffer,
    );
  }

  @EventPattern('payment.created')
  async handlePaymentCreated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('payment.created', payload, context))) return;

    this.logger.log(
      `Received payment.created event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const status = getString(payload, 'status');
    const email = getString(payload, 'email');
    if (status !== 'PENDING_REVIEW' || !email) return;

    const metadata = asRecord(payload.metadata);
    await this.emailService.sendManualPaymentReceivedEmail(email, {
      name:
        getString(metadata, 'customer_name') ||
        getString(payload, 'customer_name') ||
        'Customer',
      amount: getNumber(payload, 'amount'),
      currency: getString(payload, 'currency') || 'IDR',
      orderId:
        getString(payload, 'order_id') ||
        getString(payload, 'payment_id') ||
        'unknown-order',
    });
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('payment.failed', payload, context))) return;

    this.logger.log(
      `Received payment.failed event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) return;

    const metadata = asRecord(payload.metadata);
    await this.emailService.sendPaymentFailedEmail(email, {
      name:
        getString(metadata, 'customer_name') ||
        getString(payload, 'customer_name') ||
        'Customer',
      amount: getNumber(payload, 'amount'),
      currency: getString(payload, 'currency') || 'IDR',
      orderId:
        getString(payload, 'order_id') ||
        getString(payload, 'payment_id') ||
        'unknown-order',
      reason:
        getString(metadata, 'failure_reason') ||
        'Transaction could not be processed',
    });
  }

  @EventPattern('payment.refunded')
  async handlePaymentRefunded(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('payment.refunded', payload, context))) return;

    this.logger.log(
      `Received payment.refunded event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) return;

    const metadata = asRecord(payload.metadata);
    await this.emailService.sendPaymentRefundedEmail(email, {
      name:
        getString(metadata, 'customer_name') ||
        getString(payload, 'customer_name') ||
        'Customer',
      amount: getNumber(payload, 'amount'),
      currency: getString(payload, 'currency') || 'IDR',
      orderId:
        getString(payload, 'order_id') ||
        getString(payload, 'payment_id') ||
        'unknown-order',
      description: 'Refund for services',
    });
  }

  @EventPattern('user.registered')
  async handleUserRegistered(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('user.registered', payload, context))) return;

    this.logger.log(
      `Received user.registered event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) return;

    await this.emailService.sendWelcomeEmail(
      email,
      getString(payload, 'first_name') || getString(payload, 'name') || 'User',
      payload.brand,
    );
  }

  @EventPattern('user.forgot-password')
  async handleForgotPassword(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('user.forgot-password', payload, context)))
      return;

    this.logger.log(
      `Received user.forgot-password event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    const token = getString(payload, 'token');
    if (!email || !token) return;

    await this.emailService.sendForgotPasswordEmail(
      email,
      getString(payload, 'name') || 'User',
      token,
      payload.brand,
    );
  }

  @EventPattern('user.verify-email')
  async handleVerifyEmail(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('user.verify-email', payload, context))) return;

    this.logger.log('Received user.verify-email event START processing');
    this.logger.log(
      `Event Data: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    const token = getString(payload, 'token');
    if (!email || !token) {
      this.logger.warn(
        'Invalid data received for user.verify-email: Missing email or token',
      );
      return;
    }

    try {
      this.logger.log(
        `Calling emailService.sendVerificationEmail for ${maskEmail(email)}`,
      );
      await this.emailService.sendVerificationEmail(
        email,
        getString(payload, 'name') || 'User',
        token,
        payload.brand,
      );
      this.logger.log(
        `Email service returned successfully for ${maskEmail(email)}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing user.verify-email event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    this.logger.log('Received user.verify-email event FINISHED processing');
  }

  @EventPattern('user.email-verified')
  async handleEmailVerified(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('user.email-verified', payload, context)))
      return;

    this.logger.log(
      `Received user.email-verified event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) return;

    await this.emailService.sendEmailVerifiedEmail(
      email,
      getString(payload, 'name') || 'User',
      payload.brand,
    );
  }

  @EventPattern('support.ticket.created')
  async handleSupportTicketCreated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('support.ticket.created', payload, context)))
      return;

    this.logger.log(
      `Received support.ticket.created event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) return;
    await this.emailService.sendSupportTicketCreatedEmail(email, payload);
  }

  @EventPattern('support.ticket.replied')
  async handleSupportTicketReplied(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (!(await this.canProcess('support.ticket.replied', payload, context)))
      return;

    this.logger.log(
      `Received support.ticket.replied event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    const actorRole = getString(payload, 'actorRole');
    if (actorRole !== 'admin' || !email) return;
    await this.emailService.sendSupportTicketReplyEmail(email, payload);
  }

  @EventPattern('support.ticket.status-updated')
  async handleSupportTicketStatusUpdated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    if (
      !(await this.canProcess(
        'support.ticket.status-updated',
        payload,
        context,
      ))
    )
      return;

    this.logger.log(
      `Received support.ticket.status-updated event: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) return;
    await this.emailService.sendSupportTicketStatusUpdatedEmail(email, payload);
  }

  private async canProcess(
    eventType: string,
    data: EventPayload,
    context: RmqContext,
  ): Promise<boolean> {
    const message = context.getMessage();
    const messageProperties = asRecord(
      (message as { properties?: unknown } | undefined)?.properties,
    );
    const decision = await this.idempotencyService.shouldProcess(
      eventType,
      data,
      {
        messageId: getString(messageProperties, 'messageId'),
        correlationId: getString(messageProperties, 'correlationId'),
      },
    );

    if (!decision.shouldProcess) {
      this.logger.warn(
        `[notification-idempotency] dedupe_hit=true processed=false event=${eventType} key=${decision.dedupeKey}`,
      );
      return false;
    }

    this.logger.log(
      `[notification-idempotency] dedupe_hit=false processed=true event=${eventType} key=${decision.dedupeKey} reason=${decision.reason}`,
    );

    if (decision.reason === 'fallback') {
      this.logger.warn(
        `[notification-idempotency] fallback processing event=${eventType} key=${decision.dedupeKey}`,
      );
    }

    return true;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getString(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getArray(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function getReceiptItems(
  source: Record<string, unknown>,
  key: string,
): ReceiptItem[] {
  const rawItems = getArray(source, key);
  const normalized: ReceiptItem[] = [];

  for (const rawItem of rawItems) {
    const item = asRecord(rawItem);
    const name = getString(item, 'name');
    if (!name) continue;

    normalized.push({
      name,
      quantity: Math.max(1, getNumber(item, 'quantity') || 1),
      price: Math.max(0, getNumber(item, 'price')),
    });
  }

  return normalized;
}
