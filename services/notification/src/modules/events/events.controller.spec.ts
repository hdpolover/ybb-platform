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

describe('EventsController.handleLoaReady', () => {
  let controller: EventsController;
  let sendLoaReadyEmail: jest.Mock;

  beforeEach(() => {
    sendLoaReadyEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendLoaReadyEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({ shouldProcess: true, dedupeKey: 'key', reason: 'new' }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
    );
  });

  it('calls sendLoaReadyEmail when email is present', async () => {
    const payload = {
      email: 'jane@example.com',
      participant_name: 'Jane Doe',
      program_name: 'YBB 2026',
      document_number: 'LOA-2026-000001',
      documents_page_url: 'https://ybb.io/dashboard/documents',
      brand_id: 'brand-1',
      program_id: 'prog-1',
    };

    await controller.handleLoaReady(payload, makeContext());

    expect(sendLoaReadyEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        participant_name: 'Jane Doe',
        document_number: 'LOA-2026-000001',
      }),
    );
  });

  it('skips email silently when email field is missing', async () => {
    await controller.handleLoaReady({ no_email: true }, makeContext());
    expect(sendLoaReadyEmail).not.toHaveBeenCalled();
  });

  it('does not throw when payload is malformed (null/undefined values)', async () => {
    await expect(
      controller.handleLoaReady(null, makeContext()),
    ).resolves.not.toThrow();
    expect(sendLoaReadyEmail).not.toHaveBeenCalled();
  });
});

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
