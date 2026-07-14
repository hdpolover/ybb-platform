import { EventsController } from './events.controller';
import { EmailService } from '../email/email.service';
import { ReceiptService } from '../email/receipt.service';
import { NotificationIdempotencyService } from './notification-idempotency.service';
import { RmqContext } from '@nestjs/microservices';

const makeContext = (): RmqContext =>
  ({
    getMessage: () => ({
      content: Buffer.from('{}'),
      properties: { headers: {} },
    }),
    getChannelRef: () => ({ ack: jest.fn(), nack: jest.fn() }),
  }) as unknown as RmqContext;


describe('EventsController.handlePaymentFailed — reason field resolution', () => {
  let controller: EventsController;
  let sendPaymentFailedEmail: jest.Mock;

  beforeEach(() => {
    sendPaymentFailedEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendPaymentFailedEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({ shouldProcess: true, dedupeKey: 'key', reason: 'new' }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
    );
  });

  it('passes top-level reason field to sendPaymentFailedEmail', async () => {
    const payload = {
      email: 'jane@example.com',
      amount: 100000,
      currency: 'IDR',
      order_id: 'inv-1',
      reason: 'Insufficient funds',
      metadata: { application_id: 'app-1' },
    };

    await controller.handlePaymentFailed(payload, makeContext());

    expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ reason: 'Insufficient funds' }),
    );
  });

  it('falls back to metadata.failure_reason when top-level reason is absent', async () => {
    const payload = {
      email: 'jane@example.com',
      amount: 100000,
      currency: 'IDR',
      order_id: 'inv-1',
      metadata: { application_id: 'app-1', failure_reason: 'Card expired' },
    };

    await controller.handlePaymentFailed(payload, makeContext());

    expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ reason: 'Card expired' }),
    );
  });

  it('uses hardcoded default when neither reason field is present', async () => {
    const payload = {
      email: 'jane@example.com',
      amount: 100000,
      currency: 'IDR',
      order_id: 'inv-1',
      metadata: { application_id: 'app-1' },
    };

    await controller.handlePaymentFailed(payload, makeContext());

    expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ reason: 'Transaction could not be processed' }),
    );
  });
});

describe('EventsController.handlePaymentSucceeded — description field resolution', () => {
  let controller: EventsController;
  let sendPaymentSuccessEmail: jest.Mock;
  let generateReceipt: jest.Mock;

  beforeEach(() => {
    sendPaymentSuccessEmail = jest.fn().mockResolvedValue(undefined);
    generateReceipt = jest.fn().mockResolvedValue(Buffer.from('pdf'));
    controller = new EventsController(
      { sendPaymentSuccessEmail } as unknown as EmailService,
      { generateReceipt } as unknown as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({ shouldProcess: true, dedupeKey: 'key', reason: 'new' }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
    );
  });

  // Both producers (payment-admin.controller and payment-events.controller) put
  // `description` at the payload's top level, matching handlePaymentFailed's
  // `reason`. The success handler only read metadata.description, so every
  // receipt fell back to the generic default instead of naming the tier.
  it('passes top-level description through to the receipt', async () => {
    const payload = {
      email: 'jane@example.com',
      amount: 100000,
      currency: 'IDR',
      order_id: 'inv-1',
      description: 'Payment for Early Bird Registration',
      metadata: { application_id: 'app-1' },
    };

    await controller.handlePaymentSucceeded(payload, makeContext());

    expect(generateReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Payment for Early Bird Registration' }),
    );
    expect(sendPaymentSuccessEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ description: 'Payment for Early Bird Registration' }),
      expect.anything(),
    );
  });

  it('falls back to metadata.description when top-level is absent', async () => {
    const payload = {
      email: 'jane@example.com',
      amount: 100000,
      currency: 'IDR',
      order_id: 'inv-1',
      metadata: { application_id: 'app-1', description: 'Payment for Wave 2 Program Fee' },
    };

    await controller.handlePaymentSucceeded(payload, makeContext());

    expect(generateReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Payment for Wave 2 Program Fee' }),
    );
  });

  it('uses the generic default only when no description is present anywhere', async () => {
    const payload = {
      email: 'jane@example.com',
      amount: 100000,
      currency: 'IDR',
      order_id: 'inv-1',
      metadata: { application_id: 'app-1' },
    };

    await controller.handlePaymentSucceeded(payload, makeContext());

    expect(generateReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Payment for services' }),
    );
  });
});
