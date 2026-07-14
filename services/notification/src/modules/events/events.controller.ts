import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { EmailService } from '../email/email.service';
import { ReceiptService } from '../email/receipt.service';
import {
  maskEmail,
  summarizeEventPayload,
} from '../../common/logging/safe-log';
import {
  NotificationIdempotencyService,
  abbreviateDedupeKey,
} from './notification-idempotency.service';

type EventPayload = Record<string, unknown>;
type ReceiptItem = { name: string; quantity: number; price: number };
type RmqMessage = {
  content?: Buffer;
  properties?: {
    headers?: Record<string, unknown>;
    messageId?: string;
    correlationId?: string;
    contentType?: string;
    contentEncoding?: string;
    deliveryMode?: number;
    priority?: number;
    expiration?: string;
    timestamp?: number;
    type?: string;
    userId?: string;
    appId?: string;
  };
};
type RabbitChannel = {
  sendToQueue: (
    queue: string,
    content: Buffer,
    options?: {
      headers?: Record<string, unknown>;
      contentType?: string;
      contentEncoding?: string;
      deliveryMode?: number;
      priority?: number;
      expiration?: string;
      timestamp?: number;
      type?: string;
      userId?: string;
      appId?: string;
      persistent?: boolean;
      messageId?: string;
      correlationId?: string;
    },
  ) => boolean;
  ack: (message: unknown) => void;
  nack: (message: unknown, allUpTo?: boolean, requeue?: boolean) => void;
};

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);
  private readonly notificationQueue = 'notification_queue';
  private readonly maxRetryAttempts = parsePositiveInt(
    process.env.NOTIFICATION_QUEUE_MAX_RETRIES,
    3,
  );

  constructor(
    private readonly emailService: EmailService,
    private readonly receiptService: ReceiptService,
    private readonly idempotencyService: NotificationIdempotencyService,
  ) {}

  @EventPattern('notification.payment_succeeded')
  async handlePaymentSucceeded(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('payment.succeeded', payload, context, async () => {
      this.logger.log(
        `Received payment.succeeded event: ${JSON.stringify(summarizeEventPayload(payload))}`,
      );

      const email = getString(payload, 'email');
      if (!email) return;

      const metadata = asRecord(payload.metadata);
      const items = getReceiptItems(metadata, 'item_details');
      // Both producers emit `description` at the top level (like `reason` on
      // payment.failed); metadata is the fallback. Reading metadata only made
      // every receipt say "Payment for services" instead of naming the tier.
      const description =
        getString(payload, 'description') ||
        getString(metadata, 'description') ||
        'Payment for services';
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

      const rawBrand = asRecord(payload.brand);
      const brand = payload.brand
        ? {
            name: getString(rawBrand, 'name'),
            logoUrl: getString(rawBrand, 'logoUrl') ?? null,
            primaryColor: getString(rawBrand, 'primaryColor') ?? null,
            contactEmail: getString(rawBrand, 'contactEmail') ?? null,
            contactPhone: getString(rawBrand, 'contactPhone') ?? null,
            contactAddress: getString(rawBrand, 'contactAddress') ?? null,
            websiteUrl: getString(rawBrand, 'websiteUrl') ?? null,
          }
        : null;

      let receiptBuffer: Buffer | undefined;
      try {
        receiptBuffer = await this.receiptService.generateReceipt({
          orderId,
          amount,
          currency,
          customerName,
          customerEmail: email,
          date: new Date(),
          description,
          transactionReference: getString(payload, 'payment_id'),
          brand,
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
          invoiceUrl:
            getString(payload, 'invoiceUrl') ||
            getString(payload, 'invoice_url') ||
            getString(metadata, 'invoice_url') ||
            getString(payload, 'paymentsPageUrl') ||
            getString(payload, 'payments_page_url') ||
            getString(metadata, 'payments_page_url') ||
            '#',
          paymentsPageUrl:
            getString(payload, 'paymentsPageUrl') ||
            getString(payload, 'payments_page_url') ||
            getString(metadata, 'payments_page_url') ||
            undefined,
          submissionPageUrl:
            getString(payload, 'submissionPageUrl') ||
            getString(payload, 'submission_page_url') ||
            getString(metadata, 'submission_page_url') ||
            undefined,
          items,
          brand: payload.brand ?? undefined,
        },
        receiptBuffer,
      );
    });
  }

  @EventPattern('notification.receipt_requested')
  async handleReceiptRequested(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('receipt.requested', payload, context, async () => {
      this.logger.log(
        `Received receipt.requested event: ${JSON.stringify(summarizeEventPayload(payload))}`,
      );

      const email = getString(payload, 'email');
      if (!email) return;

      const metadata = asRecord(payload.metadata);
      // Both producers emit `description` at the top level (like `reason` on
      // payment.failed); metadata is the fallback. Reading metadata only made
      // every receipt say "Payment for services" instead of naming the tier.
      const description =
        getString(payload, 'description') ||
        getString(metadata, 'description') ||
        'Payment for services';
      const customerName =
        getString(payload, 'customer_name') ||
        getString(metadata, 'customer_name') ||
        'Customer';
      const orderId =
        getString(payload, 'order_id') ||
        getString(payload, 'payment_id') ||
        'unknown-order';
      const amount = getNumber(payload, 'amount');
      const currency = getString(payload, 'currency') || 'IDR';

      const rawBrand = asRecord(payload.brand);
      const brand = payload.brand
        ? {
            name: getString(rawBrand, 'name'),
            logoUrl: getString(rawBrand, 'logoUrl') ?? null,
            primaryColor: getString(rawBrand, 'primaryColor') ?? null,
            contactEmail: getString(rawBrand, 'contactEmail') ?? null,
            contactPhone: getString(rawBrand, 'contactPhone') ?? null,
            contactAddress: getString(rawBrand, 'contactAddress') ?? null,
            websiteUrl: getString(rawBrand, 'websiteUrl') ?? null,
          }
        : null;

      // Divergence from handlePaymentSucceeded: that handler swallows a
      // generateReceipt failure and still sends the payment-success email
      // without the PDF, because the success notification itself is the
      // primary payload. Here the PDF *is* the entire point of the email —
      // "your receipt is attached" with nothing attached is worse than no
      // email at all — so we let the error propagate. processEvent() will
      // nack the message and the queue's retry/DLX logic takes over.
      const receiptBuffer = await this.receiptService.generateReceipt({
        orderId,
        amount,
        currency,
        customerName,
        customerEmail: email,
        date: new Date(),
        description,
        transactionReference: getString(payload, 'payment_id'),
        brand,
      });

      await this.emailService.sendReceiptEmail(
        email,
        {
          name: customerName,
          amount,
          currency,
          orderId,
          description,
          invoiceUrl:
            getString(payload, 'invoiceUrl') ||
            getString(payload, 'invoice_url') ||
            getString(metadata, 'invoice_url') ||
            undefined,
          brand: payload.brand ?? undefined,
          program:
            getString(payload, 'program') || getString(metadata, 'program'),
          brandId: getString(payload, 'brandId'),
          programId: getString(payload, 'programId'),
        },
        receiptBuffer,
      );
    });
  }

  @EventPattern('notification.payment_created')
  async handlePaymentCreated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('payment.created', payload, context, async () => {
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
        brand: payload.brand ?? undefined,
      });
    });
  }

  @EventPattern('notification.payment_failed')
  async handlePaymentFailed(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('payment.failed', payload, context, async () => {
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
          getString(payload, 'reason') ||
          getString(metadata, 'failure_reason') ||
          'Transaction could not be processed',
        brand: payload.brand ?? undefined,
      });
    });
  }

  @EventPattern('payment.rejected')
  async handlePaymentRejected(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('payment.rejected', payload, context, async () => {
      this.logger.log(
        `Received payment.rejected event: ${JSON.stringify(summarizeEventPayload(payload))}`,
      );

      const email = getString(payload, 'email');
      if (!email) return;

      const metadata = asRecord(payload.metadata);
      await this.emailService.sendPaymentRejectedEmail(email, {
        name:
          getString(payload, 'customer_name') ||
          getString(metadata, 'customer_name') ||
          'Participant',
        amount: getNumber(payload, 'amount'),
        currency: getString(payload, 'currency') || 'IDR',
        orderId:
          getString(payload, 'order_id') ||
          getString(payload, 'invoice_id') ||
          getString(metadata, 'invoice_id') ||
          'unknown-invoice',
        reason:
          getString(payload, 'reason') ||
          getString(metadata, 'reason') ||
          'No reason provided',
        paymentsPageUrl:
          getString(payload, 'paymentsPageUrl') ||
          getString(payload, 'payments_page_url') ||
          undefined,
        brand: asRecord(payload.brand) ?? undefined,
      });
    });
  }

  @EventPattern('payment.reminder')
  async handlePaymentReminder(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('payment.reminder', payload, context, async () => {
      this.logger.log(
        `Received payment.reminder event: ${JSON.stringify(summarizeEventPayload(payload))}`,
      );

      const email = getString(payload, 'email');
      if (!email) return;

      const metadata = asRecord(payload.metadata);
      await this.emailService.sendPaymentReminderEmail(email, {
        name:
          getString(payload, 'customer_name') ||
          getString(metadata, 'customer_name') ||
          'Participant',
        amount: getNumber(payload, 'amount'),
        currency: getString(payload, 'currency') || 'IDR',
        orderId:
          getString(payload, 'order_id') ||
          getString(payload, 'invoice_id') ||
          getString(metadata, 'invoice_id') ||
          'unknown-invoice',
        paymentsPageUrl:
          getString(payload, 'paymentsPageUrl') ||
          getString(payload, 'payments_page_url') ||
          undefined,
      });
    });
  }

  @EventPattern('payment.issue_alternative')
  async handlePaymentIssueAlternative(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent(
      'payment.issue_alternative',
      payload,
      context,
      async () => {
        this.logger.log(
          `Received payment.issue_alternative event: ${JSON.stringify(summarizeEventPayload(payload))}`,
        );

        const email = getString(payload, 'email');
        if (!email) return;

        const metadata = asRecord(payload.metadata);
        await this.emailService.sendPaymentIssueAlternativeEmail(email, {
          name:
            getString(payload, 'customer_name') ||
            getString(metadata, 'customer_name') ||
            'Participant',
          programName:
            getString(payload, 'program') ||
            getString(metadata, 'program') ||
            undefined,
          paymentUrl:
            getString(payload, 'paymentsPageUrl') ||
            getString(payload, 'payments_page_url') ||
            undefined,
          brand: asRecord(payload.brand) ?? undefined,
          brandId: getString(payload, 'brandId'),
          programId: getString(payload, 'programId'),
          orderId:
            getString(payload, 'order_id') ||
            getString(payload, 'invoice_id') ||
            getString(metadata, 'invoice_id') ||
            'unknown-invoice',
          amount: getNumber(payload, 'amount'),
          currency: getString(payload, 'currency') || 'IDR',
        });
      },
    );
  }

  @EventPattern('payment.cancelled')
  handlePaymentCancelled(@Ctx() context: RmqContext) {
    this.acknowledgeMessage(context, 'payment.cancelled', 'skipped');
  }

  @EventPattern('notification.payment_refunded')
  async handlePaymentRefunded(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('payment.refunded', payload, context, async () => {
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
        brand: payload.brand ?? undefined,
      });
    });
  }

  @EventPattern('user.registered')
  async handleUserRegistered(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('user.registered', payload, context, async () => {
      this.logger.log(
        `Received user.registered event: ${JSON.stringify(summarizeEventPayload(payload))}`,
      );

      const email = getString(payload, 'email');
      if (!email) return;

      await this.emailService.sendWelcomeEmail(
        email,
        getString(payload, 'first_name') ||
          getString(payload, 'name') ||
          'User',
        payload.brand,
      );
    });
  }

  @EventPattern('user.forgot-password')
  async handleForgotPassword(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent(
      'user.forgot-password',
      payload,
      context,
      async () => {
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
      },
    );
  }

  @EventPattern('user.verify-email')
  async handleVerifyEmail(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent('user.verify-email', payload, context, async () => {
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
      this.logger.log('Received user.verify-email event FINISHED processing');
    });
  }

  @EventPattern('user.email-verified')
  async handleEmailVerified(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent(
      'user.email-verified',
      payload,
      context,
      async () => {
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
      },
    );
  }

  @EventPattern('support.ticket.created')
  async handleSupportTicketCreated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent(
      'support.ticket.created',
      payload,
      context,
      async () => {
        this.logger.log(
          `Received support.ticket.created event: ${JSON.stringify(summarizeEventPayload(payload))}`,
        );

        const email = getString(payload, 'email');
        if (!email) return;
        await this.emailService.sendSupportTicketCreatedEmail(email, payload);
      },
    );
  }

  @EventPattern('support.ticket.replied')
  async handleSupportTicketReplied(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent(
      'support.ticket.replied',
      payload,
      context,
      async () => {
        this.logger.log(
          `Received support.ticket.replied event: ${JSON.stringify(summarizeEventPayload(payload))}`,
        );

        const email = getString(payload, 'email');
        const actorRole = getString(payload, 'actorRole');
        if (actorRole !== 'admin' || !email) return;
        await this.emailService.sendSupportTicketReplyEmail(email, payload);
      },
    );
  }

  @EventPattern('notification.ambassador_created')
  async handleAmbassadorCreated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent(
      'notification.ambassador_created',
      payload,
      context,
      async () => {
        this.logger.log(
          `Received notification.ambassador_created event: ${JSON.stringify(summarizeEventPayload(payload))}`,
        );

        const email = getString(payload, 'email');
        if (!email) return;

        await this.emailService.sendAmbassadorWelcomeEmail(email, {
          name: getString(payload, 'name') || 'Ambassador',
          referralCode: getString(payload, 'referralCode') || '',
          loginUrl: getString(payload, 'loginUrl') || '#',
          brand: payload.brand ?? undefined,
        });
      },
    );
  }

  @EventPattern('support.ticket.status-updated')
  async handleSupportTicketStatusUpdated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const payload = asRecord(data);
    await this.processEvent(
      'support.ticket.status-updated',
      payload,
      context,
      async () => {
        this.logger.log(
          `Received support.ticket.status-updated event: ${JSON.stringify(summarizeEventPayload(payload))}`,
        );

        const email = getString(payload, 'email');
        if (!email) return;
        await this.emailService.sendSupportTicketStatusUpdatedEmail(
          email,
          payload,
        );
      },
    );
  }

  private async processEvent(
    eventType: string,
    data: EventPayload,
    context: RmqContext,
    processor: () => Promise<void>,
  ): Promise<void> {
    if (!(await this.canProcess(eventType, data, context))) {
      this.acknowledgeMessage(context, eventType, 'skipped');
      return;
    }

    try {
      await processor();
      this.acknowledgeMessage(context, eventType, 'processed');
    } catch (error) {
      this.logger.error(
        `[notification-retry] processing failed event=${eventType}; routing to retry queue`,
        error instanceof Error ? error.stack : String(error),
      );
      this.rejectForRetry(context, eventType);
    }
  }

  private acknowledgeMessage(
    context: RmqContext,
    eventType: string,
    reason: 'processed' | 'skipped',
  ) {
    const message = context.getMessage();
    const channel = context.getChannelRef() as RabbitChannel | undefined;
    if (!message || !channel) {
      this.logger.error(
        `[notification-ack] unable to ack event=${eventType} reason=${reason}`,
      );
      return;
    }

    channel.ack(message);
  }

  private rejectForRetry(context: RmqContext, eventType: string) {
    const message = context.getMessage();
    const channel = context.getChannelRef() as RabbitChannel | undefined;
    if (!message || !channel) {
      this.logger.error(
        `[notification-retry] unable to nack event=${eventType}; message or channel missing`,
      );
      return;
    }

    // requeue=false delegates retry scheduling to notification_queue.retry via DLX.
    channel.nack(message, false, false);
  }

  private async canProcess(
    eventType: string,
    data: EventPayload,
    context: RmqContext,
  ): Promise<boolean> {
    if (this.moveToDlqWhenRetryExhausted(eventType, context)) {
      return false;
    }

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
        `[notification-idempotency] dedupe_hit=true processed=false event=${eventType} key=${abbreviateDedupeKey(decision.dedupeKey)}`,
      );
      return false;
    }

    this.logger.log(
      `[notification-idempotency] dedupe_hit=false processed=true event=${eventType} key=${abbreviateDedupeKey(decision.dedupeKey)} reason=${decision.reason}`,
    );

    if (decision.reason === 'fallback') {
      this.logger.warn(
        `[notification-idempotency] fallback processing event=${eventType} key=${abbreviateDedupeKey(decision.dedupeKey)}`,
      );
    }

    return true;
  }

  private moveToDlqWhenRetryExhausted(
    eventType: string,
    context: RmqContext,
  ): boolean {
    const message = context.getMessage() as RmqMessage | undefined;
    const headers = asRecord(message?.properties?.headers);
    const retryCount = getRejectedRetryCount(headers, this.notificationQueue);
    if (retryCount < this.maxRetryAttempts) {
      return false;
    }

    const channel = context.getChannelRef() as RabbitChannel | undefined;
    const content = message?.content;
    if (!message || !channel || !content) {
      this.logger.error(
        `[notification-retry] max retries reached but message could not be routed to DLQ event=${eventType}`,
      );
      return true;
    }

    const dlqName = `${this.notificationQueue}.dlq`;
    const existingHeaders = asRecord(message.properties?.headers);
    const dlqHeaders: Record<string, unknown> = {
      ...existingHeaders,
      'x-final-reason': 'retry-exhausted',
      'x-final-event-type': eventType,
      'x-final-retry-count': retryCount,
    };

    channel.sendToQueue(dlqName, content, {
      persistent: true,
      headers: dlqHeaders,
      messageId: message.properties?.messageId,
      correlationId: message.properties?.correlationId,
      contentType: message.properties?.contentType,
      contentEncoding: message.properties?.contentEncoding,
      deliveryMode: message.properties?.deliveryMode,
      priority: message.properties?.priority,
      expiration: message.properties?.expiration,
      timestamp: message.properties?.timestamp,
      type: message.properties?.type,
      userId: message.properties?.userId,
      appId: message.properties?.appId,
    });

    this.logger.error(
      `[notification-retry] moved to DLQ event=${eventType} queue=${dlqName} retries=${retryCount}`,
    );
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

function getRejectedRetryCount(
  headers: Record<string, unknown>,
  queueName: string,
): number {
  const xDeathRaw = headers['x-death'];
  if (!Array.isArray(xDeathRaw)) return 0;

  let retries = 0;
  for (const item of xDeathRaw) {
    const death = asRecord(item);
    const queue = getString(death, 'queue');
    const reason = getString(death, 'reason');
    if (queue !== queueName || reason !== 'rejected') continue;

    const countRaw = death.count;
    if (typeof countRaw === 'number' && Number.isFinite(countRaw)) {
      retries += Math.floor(countRaw);
      continue;
    }

    if (typeof countRaw === 'string' && countRaw.trim()) {
      const parsed = Number(countRaw);
      if (Number.isFinite(parsed)) {
        retries += Math.floor(parsed);
      }
    }
  }

  return retries;
}

function parsePositiveInt(
  value: string | undefined,
  defaultValue: number,
): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : defaultValue;
}
