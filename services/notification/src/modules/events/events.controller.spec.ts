import { EventsController } from './events.controller';
import { EmailService } from '../email/email.service';
import { ReceiptService } from '../email/receipt.service';
import { NotificationIdempotencyService } from './notification-idempotency.service';
import { RabbitMQProducerService } from '../../shared/rabbitmq/rabbitmq-producer.service';
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
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
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
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
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
      expect.objectContaining({
        description: 'Payment for Early Bird Registration',
      }),
    );
    expect(sendPaymentSuccessEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        description: 'Payment for Early Bird Registration',
      }),
      expect.anything(),
    );
  });

  it('falls back to metadata.description when top-level is absent', async () => {
    const payload = {
      email: 'jane@example.com',
      amount: 100000,
      currency: 'IDR',
      order_id: 'inv-1',
      metadata: {
        application_id: 'app-1',
        description: 'Payment for Wave 2 Program Fee',
      },
    };

    await controller.handlePaymentSucceeded(payload, makeContext());

    expect(generateReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Payment for Wave 2 Program Fee',
      }),
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

describe('EventsController.handleLoaBatchReleased', () => {
  let controller: EventsController;
  let sendLoaReadyEmail: jest.Mock;

  beforeEach(() => {
    sendLoaReadyEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendLoaReadyEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('sends one LOA-ready email per recipient', async () => {
    const payload = {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [
        { userId: 'user-1', email: 'jane@example.com', fullName: 'Jane Doe' },
        { userId: 'user-2', email: 'john@example.com', fullName: 'John Smith' },
      ],
    };

    await controller.handleLoaBatchReleased(payload, makeContext());

    expect(sendLoaReadyEmail).toHaveBeenCalledTimes(2);
    expect(sendLoaReadyEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        program: 'YBB Summit 2026',
        programId: 'prog-1',
      }),
    );
    expect(sendLoaReadyEmail).toHaveBeenCalledWith(
      'john@example.com',
      expect.objectContaining({ name: 'John Smith' }),
    );
  });

  it('does nothing when recipients array is empty', async () => {
    const payload = {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [],
    };

    await controller.handleLoaBatchReleased(payload, makeContext());

    expect(sendLoaReadyEmail).not.toHaveBeenCalled();
  });

  it('skips recipients without an email and continues sending to the rest', async () => {
    const payload = {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [
        { userId: 'user-1', fullName: 'No Email' },
        { userId: 'user-2', email: 'john@example.com', fullName: 'John Smith' },
      ],
    };

    await controller.handleLoaBatchReleased(payload, makeContext());

    expect(sendLoaReadyEmail).toHaveBeenCalledTimes(1);
    expect(sendLoaReadyEmail).toHaveBeenCalledWith(
      'john@example.com',
      expect.anything(),
    );
  });

  it('continues sending to remaining recipients when one send fails', async () => {
    sendLoaReadyEmail
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined);
    const payload = {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [
        { userId: 'user-1', email: 'jane@example.com', fullName: 'Jane Doe' },
        { userId: 'user-2', email: 'john@example.com', fullName: 'John Smith' },
      ],
    };

    await controller.handleLoaBatchReleased(payload, makeContext());

    expect(sendLoaReadyEmail).toHaveBeenCalledTimes(2);
  });

  it('threads the batch-level brand through to every recipient email', async () => {
    const payload = {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [
        { userId: 'user-1', email: 'jane@example.com', fullName: 'Jane Doe' },
      ],
      brand: { name: 'YBB', websiteUrl: 'youthacademicforum.com' },
    };

    await controller.handleLoaBatchReleased(payload, makeContext());

    expect(sendLoaReadyEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        brand: { name: 'YBB', websiteUrl: 'youthacademicforum.com' },
      }),
    );
  });

  it('passes brand: undefined when the payload has no brand', async () => {
    const payload = {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [
        { userId: 'user-1', email: 'jane@example.com', fullName: 'Jane Doe' },
      ],
    };

    await controller.handleLoaBatchReleased(payload, makeContext());

    expect(sendLoaReadyEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ brand: undefined }),
    );
  });
});

describe('EventsController.handleSubmissionReminder', () => {
  let controller: EventsController;
  let sendSubmissionReminderEmail: jest.Mock;

  beforeEach(() => {
    sendSubmissionReminderEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendSubmissionReminderEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('sends the submission reminder email with the deadline/offset payload', async () => {
    const payload = {
      email: 'jane@example.com',
      customer_name: 'Jane Doe',
      program: 'China Youth Summit 2027',
      programId: 'prog-1',
      brandId: 'brand-1',
      deadline: '2027-01-08T10:00:00.000Z',
      daysRemaining: 7,
      submissionPageUrl: 'https://cys.example.com/dashboard/submission',
      metadata: { application_id: 'app-1', reminder_offset: 7 },
    };

    await controller.handleSubmissionReminder(payload, makeContext());

    expect(sendSubmissionReminderEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        program: 'China Youth Summit 2027',
        programId: 'prog-1',
        deadline: '2027-01-08T10:00:00.000Z',
        daysRemaining: 7,
        submissionPageUrl: 'https://cys.example.com/dashboard/submission',
      }),
    );
  });

  it('falls back to metadata.reminder_offset when top-level daysRemaining is absent', async () => {
    const payload = {
      email: 'jane@example.com',
      customer_name: 'Jane Doe',
      metadata: { application_id: 'app-1', reminder_offset: 1 },
    };

    await controller.handleSubmissionReminder(payload, makeContext());

    expect(sendSubmissionReminderEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ daysRemaining: 1 }),
    );
  });

  it('does nothing when the payload has no email', async () => {
    await controller.handleSubmissionReminder(
      { daysRemaining: 7 },
      makeContext(),
    );

    expect(sendSubmissionReminderEmail).not.toHaveBeenCalled();
  });
});

// ─── loa.batch.released → loa.batch.send_result ───────────────────────────────
// The per-recipient try/catch in handleLoaBatchReleased used to swallow
// failures into container logs (~2 day retention) and nothing else, so
// "did this participant get their letter?" was unanswerable weeks later.
// These cover the outcome-reporting path that replaces that blind spot.

describe('EventsController.handleLoaBatchReleased — send result reporting', () => {
  const buildController = (sendLoaReadyEmail: jest.Mock, emit: jest.Mock) =>
    new EventsController(
      { sendLoaReadyEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      { emit } as unknown as RabbitMQProducerService,
    );

  type ReportedResult = {
    participantId: string;
    providerMessageId: string | null;
    error: string | null;
  };

  // emit.mock.calls is any[][]; narrow once here so each assertion below can
  // read the reported outcomes without an unsafe member access.
  const reportedResults = (emit: jest.Mock): ReportedResult[] => {
    const [, event] = emit.mock.calls[0] as [string, { results: ReportedResult[] }];
    return event.results;
  };

  const payload = {
    batchId: 'batch-1',
    programId: 'prog-1',
    programName: 'YBB 2026',
    batchName: 'Wave 1',
    recipients: [
      {
        participantId: 'p-1',
        userId: 'u-1',
        email: 'ok@example.com',
        fullName: 'Ada',
      },
      {
        participantId: 'p-2',
        userId: 'u-2',
        email: 'bad@example.com',
        fullName: 'Bob',
      },
    ],
    brand: null,
  };

  it('reports one result per recipient, with the provider id on success and the error on failure', async () => {
    const sendLoaReadyEmail = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'resend-abc' } })
      .mockRejectedValueOnce(new Error('mailbox full'));
    const emit = jest.fn().mockResolvedValue(true);

    await buildController(sendLoaReadyEmail, emit).handleLoaBatchReleased(
      payload,
      makeContext(),
    );

    expect(emit).toHaveBeenCalledWith('loa.batch.send_result', {
      batchId: 'batch-1',
      programId: 'prog-1',
      results: [
        { participantId: 'p-1', providerMessageId: 'resend-abc', error: null },
        {
          participantId: 'p-2',
          providerMessageId: null,
          error: 'mailbox full',
        },
      ],
    });
  });

  it('reads a nodemailer messageId as the provider id', async () => {
    const sendLoaReadyEmail = jest
      .fn()
      .mockResolvedValue({ messageId: '<smtp-1@ybb>' });
    const emit = jest.fn().mockResolvedValue(true);

    await buildController(sendLoaReadyEmail, emit).handleLoaBatchReleased(
      { ...payload, recipients: [payload.recipients[0]] },
      makeContext(),
    );

    expect(reportedResults(emit)[0].providerMessageId).toBe('<smtp-1@ybb>');
  });

  it('records a null provider id when no transporter is configured', async () => {
    const sendLoaReadyEmail = jest.fn().mockResolvedValue(undefined);
    const emit = jest.fn().mockResolvedValue(true);

    await buildController(sendLoaReadyEmail, emit).handleLoaBatchReleased(
      { ...payload, recipients: [payload.recipients[0]] },
      makeContext(),
    );

    expect(reportedResults(emit)[0]).toEqual({
      participantId: 'p-1',
      providerMessageId: null,
      error: null,
    });
  });

  it('still sends to every recipient when one fails, and does not throw', async () => {
    const sendLoaReadyEmail = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ data: { id: 'resend-xyz' } });
    const emit = jest.fn().mockResolvedValue(true);

    await expect(
      buildController(sendLoaReadyEmail, emit).handleLoaBatchReleased(
        payload,
        makeContext(),
      ),
    ).resolves.not.toThrow();

    expect(sendLoaReadyEmail).toHaveBeenCalledTimes(2);
  });

  it('does not throw when publishing the result event fails — the emails already went out', async () => {
    const sendLoaReadyEmail = jest
      .fn()
      .mockResolvedValue({ data: { id: 'resend-abc' } });
    const emit = jest.fn().mockRejectedValue(new Error('broker down'));

    await expect(
      buildController(sendLoaReadyEmail, emit).handleLoaBatchReleased(
        payload,
        makeContext(),
      ),
    ).resolves.not.toThrow();
  });

  it('skips reporting when recipients carry no participantId (older API payload)', async () => {
    const sendLoaReadyEmail = jest.fn().mockResolvedValue(undefined);
    const emit = jest.fn().mockResolvedValue(true);

    await buildController(sendLoaReadyEmail, emit).handleLoaBatchReleased(
      {
        ...payload,
        recipients: [
          { userId: 'u-1', email: 'ok@example.com', fullName: 'Ada' },
        ],
      },
      makeContext(),
    );

    expect(sendLoaReadyEmail).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it('truncates an oversized provider error before it reaches the event', async () => {
    const sendLoaReadyEmail = jest
      .fn()
      .mockRejectedValue(new Error('x'.repeat(900)));
    const emit = jest.fn().mockResolvedValue(true);

    await buildController(sendLoaReadyEmail, emit).handleLoaBatchReleased(
      { ...payload, recipients: [payload.recipients[0]] },
      makeContext(),
    );

    const reported = reportedResults(emit)[0].error as string;
    expect(reported).toHaveLength(500);
    expect(reported.endsWith('…')).toBe(true);
  });
});
