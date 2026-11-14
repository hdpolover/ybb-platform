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
        release: jest.fn().mockResolvedValue(undefined),
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
        release: jest.fn().mockResolvedValue(undefined),
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
        release: jest.fn().mockResolvedValue(undefined),
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

describe('EventsController.handleSubmissionNudge', () => {
  let controller: EventsController;
  let sendSubmissionNudgeEmail: jest.Mock;

  beforeEach(() => {
    sendSubmissionNudgeEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendSubmissionNudgeEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('resolves the template and sends the nudge email', async () => {
    const payload = {
      email: 'jane@example.com',
      customer_name: 'Jane Doe',
      program_name: 'YBB Summit 2026',
      application_id: 'app-1',
      submission_url: 'https://portal.example.com/submit',
      brand: { name: 'YBB', websiteUrl: 'ybb.foundation' },
    };

    await controller.handleSubmissionNudge(payload, makeContext());

    expect(sendSubmissionNudgeEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        program: 'YBB Summit 2026',
        applicationId: 'app-1',
        submissionUrl: 'https://portal.example.com/submit',
        brand: { name: 'YBB', websiteUrl: 'ybb.foundation' },
      }),
    );
  });

  it('does nothing when the payload has no email', async () => {
    const payload = { customer_name: 'Jane Doe' };

    await controller.handleSubmissionNudge(payload, makeContext());

    expect(sendSubmissionNudgeEmail).not.toHaveBeenCalled();
  });

  it('does not crash the consumer when the send fails', async () => {
    sendSubmissionNudgeEmail.mockRejectedValueOnce(new Error('smtp down'));
    const payload = {
      email: 'jane@example.com',
      submission_url: 'https://portal.example.com/submit',
    };

    await expect(
      controller.handleSubmissionNudge(payload, makeContext()),
    ).resolves.toBeUndefined();
  });
});

describe('EventsController.handleDraftNudge', () => {
  let controller: EventsController;
  let sendDraftNudgeEmail: jest.Mock;
  let shouldProcess: jest.Mock;
  let claimRedelivery: jest.Mock;

  beforeEach(() => {
    sendDraftNudgeEmail = jest.fn().mockResolvedValue(undefined);
    shouldProcess = jest.fn().mockResolvedValue({
      shouldProcess: true,
      dedupeKey: 'key',
      reason: 'new',
    });
    claimRedelivery = jest.fn().mockResolvedValue(false);
    controller = new EventsController(
      { sendDraftNudgeEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess,
        claimRedelivery,
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  const payload = {
    email: 'jane@example.com',
    customer_name: 'Jane Doe',
    program_name: 'YBB Summit 2026',
    application_id: 'app-1',
    nudge_number: 2,
    submission_url: 'https://portal.example.com/dashboard/submission',
    deadline: '2026-12-20T00:00:00.000Z',
    brand: { name: 'YBB' },
  };

  it('sends the draft nudge with the mapped fields', async () => {
    await controller.handleDraftNudge(payload, makeContext());

    expect(sendDraftNudgeEmail).toHaveBeenCalledWith('jane@example.com', {
      name: 'Jane Doe',
      program: 'YBB Summit 2026',
      nudgeNumber: 2,
      submissionUrl: 'https://portal.example.com/dashboard/submission',
      deadline: '2026-12-20T00:00:00.000Z',
      brand: { name: 'YBB' },
    });
  });

  it('defaults to nudge 1 and tolerates a null deadline and empty name', async () => {
    await controller.handleDraftNudge(
      { email: 'jane@example.com', customer_name: '', deadline: null },
      makeContext(),
    );

    expect(sendDraftNudgeEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ name: undefined, nudgeNumber: 1, deadline: undefined, submissionUrl: '#' }),
    );
  });

  it('does nothing when the payload has no email', async () => {
    await controller.handleDraftNudge({ nudge_number: 1 }, makeContext());

    expect(sendDraftNudgeEmail).not.toHaveBeenCalled();
  });

  it('does not send a duplicate delivery of the same message', async () => {
    shouldProcess.mockResolvedValueOnce({ shouldProcess: false, dedupeKey: 'key', reason: 'duplicate' });

    await controller.handleDraftNudge(payload, makeContext());

    expect(sendDraftNudgeEmail).not.toHaveBeenCalled();
  });

  describe('broker redelivery of a message whose dedupe key is already claimed', () => {
    // The consumer that claimed the key was killed before it sent or acked.
    const redeliveredContext = (ack = jest.fn()): RmqContext =>
      ({
        getMessage: () => ({
          fields: { redelivered: true },
          content: Buffer.from('{}'),
          properties: { headers: {} },
        }),
        getChannelRef: () => ({ ack, nack: jest.fn() }),
      }) as unknown as RmqContext;

    beforeEach(() => {
      shouldProcess.mockResolvedValue({ shouldProcess: false, dedupeKey: 'key', reason: 'duplicate' });
    });

    it('sends it once more', async () => {
      claimRedelivery.mockResolvedValueOnce(true);
      const ack = jest.fn();

      await controller.handleDraftNudge(payload, redeliveredContext(ack));

      expect(claimRedelivery).toHaveBeenCalledWith('key');
      expect(sendDraftNudgeEmail).toHaveBeenCalledTimes(1);
      expect(ack).toHaveBeenCalledTimes(1);
    });

    it('skips it when the one reprocessing was already used', async () => {
      claimRedelivery.mockResolvedValueOnce(false);
      const ack = jest.fn();

      await controller.handleDraftNudge(payload, redeliveredContext(ack));

      expect(sendDraftNudgeEmail).not.toHaveBeenCalled();
      expect(ack).toHaveBeenCalledTimes(1);
    });

    it('never reprocesses a fan-out batch, which would re-mail every recipient already sent to', async () => {
      const sendLoaReleasedEmail = jest.fn().mockResolvedValue(undefined);
      const fanOutController = new EventsController(
        { sendLoaReleasedEmail } as unknown as EmailService,
        {} as ReceiptService,
        { shouldProcess, claimRedelivery, release: jest.fn() } as unknown as NotificationIdempotencyService,
        { emit: jest.fn().mockResolvedValue(true) } as unknown as RabbitMQProducerService,
      );

      await fanOutController.handleLoaBatchReleased(
        { recipients: [{ email: 'jane@example.com' }] },
        redeliveredContext(),
      );

      expect(claimRedelivery).not.toHaveBeenCalled();
      expect(sendLoaReleasedEmail).not.toHaveBeenCalled();
    });
  });
});

describe('EventsController.handleFundingResult', () => {
  let controller: EventsController;
  let sendFundingResultEmail: jest.Mock;
  let shouldProcess: jest.Mock;

  beforeEach(() => {
    sendFundingResultEmail = jest.fn().mockResolvedValue(undefined);
    shouldProcess = jest.fn().mockResolvedValue({
      shouldProcess: true,
      dedupeKey: 'key',
      reason: 'new',
    });
    controller = new EventsController(
      { sendFundingResultEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess,
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  const payload = {
    email: 'jane@example.com',
    customer_name: 'Jane Doe',
    program_name: 'YBB Summit 2026',
    application_id: 'app-1',
    decision: 'awarded',
    portal_url: 'https://portal.example.com/dashboard',
    brand: { name: 'YBB' },
  };

  it('sends the funding result with the mapped fields', async () => {
    await controller.handleFundingResult(payload, makeContext());

    expect(sendFundingResultEmail).toHaveBeenCalledWith('jane@example.com', {
      name: 'Jane Doe',
      program: 'YBB Summit 2026',
      decision: 'awarded',
      portalUrl: 'https://portal.example.com/dashboard',
      brand: { name: 'YBB' },
    });
  });

  it('passes not_awarded through and tolerates an empty name', async () => {
    await controller.handleFundingResult(
      { ...payload, customer_name: '', decision: 'not_awarded' },
      makeContext(),
    );

    expect(sendFundingResultEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ name: undefined, decision: 'not_awarded' }),
    );
  });

  it('sends nothing for an unknown or missing decision', async () => {
    await controller.handleFundingResult({ ...payload, decision: 'maybe' }, makeContext());
    await controller.handleFundingResult({ ...payload, decision: undefined }, makeContext());

    expect(sendFundingResultEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the payload has no email', async () => {
    await controller.handleFundingResult({ decision: 'awarded' }, makeContext());

    expect(sendFundingResultEmail).not.toHaveBeenCalled();
  });

  it('does not send a duplicate delivery of the same message', async () => {
    shouldProcess.mockResolvedValueOnce({ shouldProcess: false, dedupeKey: 'key', reason: 'duplicate' });

    await controller.handleFundingResult(payload, makeContext());

    expect(sendFundingResultEmail).not.toHaveBeenCalled();
  });
});

describe('EventsController.handleApplicationSubmitted', () => {
  let controller: EventsController;
  let sendApplicationSubmittedEmail: jest.Mock;
  let shouldProcess: jest.Mock;

  beforeEach(() => {
    sendApplicationSubmittedEmail = jest.fn().mockResolvedValue(undefined);
    shouldProcess = jest.fn().mockResolvedValue({
      shouldProcess: true,
      dedupeKey: 'key',
      reason: 'new',
    });
    controller = new EventsController(
      { sendApplicationSubmittedEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess,
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('sends the submitted email with program, date and portal link', async () => {
    const payload = {
      email: 'jane@example.com',
      customer_name: 'Jane Doe',
      program_name: 'Korea Youth Summit',
      application_id: 'app-1',
      submitted_at: '2026-11-12T10:00:00.000Z',
      portal_url: 'https://www.example.com/dashboard/submission',
      brand: { name: 'YBB' },
    };

    await controller.handleApplicationSubmitted(payload, makeContext());

    expect(shouldProcess).toHaveBeenCalledWith(
      'application.submitted',
      payload,
      expect.anything(),
    );
    expect(sendApplicationSubmittedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        program: 'Korea Youth Summit',
        applicationId: 'app-1',
        submittedAt: '2026-11-12T10:00:00.000Z',
        portalUrl: 'https://www.example.com/dashboard/submission',
        brand: { name: 'YBB' },
      }),
    );
  });

  it('does not send when the idempotency check reports a duplicate', async () => {
    shouldProcess.mockResolvedValue({
      shouldProcess: false,
      dedupeKey: 'key',
      reason: 'duplicate',
    });

    await controller.handleApplicationSubmitted(
      { email: 'jane@example.com' },
      makeContext(),
    );

    expect(sendApplicationSubmittedEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the payload has no email', async () => {
    await controller.handleApplicationSubmitted(
      { customer_name: 'Jane Doe' },
      makeContext(),
    );

    expect(sendApplicationSubmittedEmail).not.toHaveBeenCalled();
  });

  it('does not crash the consumer when the send fails', async () => {
    sendApplicationSubmittedEmail.mockRejectedValueOnce(new Error('smtp down'));

    await expect(
      controller.handleApplicationSubmitted(
        { email: 'jane@example.com' },
        makeContext(),
      ),
    ).resolves.toBeUndefined();
  });
});

describe('EventsController.handleApplicationAccepted', () => {
  let controller: EventsController;
  let sendApplicationAcceptedEmail: jest.Mock;

  beforeEach(() => {
    sendApplicationAcceptedEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendApplicationAcceptedEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('resolves the template and sends the acceptance email', async () => {
    const payload = {
      email: 'jane@example.com',
      customer_name: 'Jane Doe',
      program_name: 'YBB Summit 2026',
      application_id: 'app-1',
      documents_url: 'https://portal.example.com/documents',
      brand: { name: 'YBB', websiteUrl: 'ybb.foundation' },
    };

    await controller.handleApplicationAccepted(payload, makeContext());

    expect(sendApplicationAcceptedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        program: 'YBB Summit 2026',
        applicationId: 'app-1',
        documentsUrl: 'https://portal.example.com/documents',
        brand: { name: 'YBB', websiteUrl: 'ybb.foundation' },
      }),
    );
  });

  it('does nothing when the payload has no email', async () => {
    const payload = { customer_name: 'Jane Doe' };

    await controller.handleApplicationAccepted(payload, makeContext());

    expect(sendApplicationAcceptedEmail).not.toHaveBeenCalled();
  });

  it('does not crash the consumer when the send fails', async () => {
    sendApplicationAcceptedEmail.mockRejectedValueOnce(new Error('smtp down'));
    const payload = {
      email: 'jane@example.com',
      documents_url: 'https://portal.example.com/documents',
    };

    await expect(
      controller.handleApplicationAccepted(payload, makeContext()),
    ).resolves.toBeUndefined();
  });
});

describe('EventsController.handleDocumentApproved', () => {
  let controller: EventsController;
  let sendDocumentApprovedEmail: jest.Mock;

  beforeEach(() => {
    sendDocumentApprovedEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendDocumentApprovedEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('resolves the template and sends the approval email', async () => {
    const payload = {
      email: 'jane@example.com',
      participant_name: 'Jane Doe',
      program_name: 'YBB Summit 2026',
      document_name: 'Agreement Letter',
      application_id: 'app-1',
      document_id: 'doc-1',
      outcome: 'approved',
      note: null,
    };

    await controller.handleDocumentApproved(payload, makeContext());

    expect(sendDocumentApprovedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        program: 'YBB Summit 2026',
        documentName: 'Agreement Letter',
      }),
    );
  });

  it('does nothing when the payload has no email', async () => {
    const payload = { document_name: 'Agreement Letter' };

    await controller.handleDocumentApproved(payload, makeContext());

    expect(sendDocumentApprovedEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the payload has no document_name', async () => {
    const payload = { email: 'jane@example.com' };

    await controller.handleDocumentApproved(payload, makeContext());

    expect(sendDocumentApprovedEmail).not.toHaveBeenCalled();
  });

  it('does not crash the consumer when the send fails', async () => {
    sendDocumentApprovedEmail.mockRejectedValueOnce(new Error('smtp down'));
    const payload = {
      email: 'jane@example.com',
      document_name: 'Agreement Letter',
    };

    await expect(
      controller.handleDocumentApproved(payload, makeContext()),
    ).resolves.toBeUndefined();
  });
});

describe('EventsController.handleDocumentRejected', () => {
  let controller: EventsController;
  let sendDocumentRejectedEmail: jest.Mock;

  beforeEach(() => {
    sendDocumentRejectedEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendDocumentRejectedEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('resolves the template and sends the rejection email with the note', async () => {
    const payload = {
      email: 'jane@example.com',
      participant_name: 'Jane Doe',
      program_name: 'YBB Summit 2026',
      document_name: 'Agreement Letter',
      outcome: 'rejected',
      note: 'The signature page is missing.',
    };

    await controller.handleDocumentRejected(payload, makeContext());

    expect(sendDocumentRejectedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        documentName: 'Agreement Letter',
        note: 'The signature page is missing.',
      }),
    );
  });

  it('does nothing when the payload has no note', async () => {
    const payload = {
      email: 'jane@example.com',
      document_name: 'Agreement Letter',
    };

    await controller.handleDocumentRejected(payload, makeContext());

    expect(sendDocumentRejectedEmail).not.toHaveBeenCalled();
  });

  it('does not crash the consumer when the send fails', async () => {
    sendDocumentRejectedEmail.mockRejectedValueOnce(new Error('smtp down'));
    const payload = {
      email: 'jane@example.com',
      document_name: 'Agreement Letter',
      note: 'Missing page.',
    };

    await expect(
      controller.handleDocumentRejected(payload, makeContext()),
    ).resolves.toBeUndefined();
  });
});

describe('EventsController.handleDocumentRevisionRequested', () => {
  let controller: EventsController;
  let sendDocumentRevisionRequestedEmail: jest.Mock;

  beforeEach(() => {
    sendDocumentRevisionRequestedEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendDocumentRevisionRequestedEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      {
        emit: jest.fn().mockResolvedValue(true),
      } as unknown as RabbitMQProducerService,
    );
  });

  it('resolves the template and sends the revision-requested email with the note', async () => {
    const payload = {
      email: 'jane@example.com',
      participant_name: 'Jane Doe',
      program_name: 'YBB Summit 2026',
      document_name: 'Agreement Letter',
      outcome: 'revision_requested',
      note: 'Please re-scan page 2, it is blurry.',
    };

    await controller.handleDocumentRevisionRequested(payload, makeContext());

    expect(sendDocumentRevisionRequestedEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({
        name: 'Jane Doe',
        documentName: 'Agreement Letter',
        note: 'Please re-scan page 2, it is blurry.',
      }),
    );
  });

  it('does nothing when the payload has no note', async () => {
    const payload = {
      email: 'jane@example.com',
      document_name: 'Agreement Letter',
    };

    await controller.handleDocumentRevisionRequested(payload, makeContext());

    expect(sendDocumentRevisionRequestedEmail).not.toHaveBeenCalled();
  });

  it('does not crash the consumer when the send fails', async () => {
    sendDocumentRevisionRequestedEmail.mockRejectedValueOnce(
      new Error('smtp down'),
    );
    const payload = {
      email: 'jane@example.com',
      document_name: 'Agreement Letter',
      note: 'Blurry scan.',
    };

    await expect(
      controller.handleDocumentRevisionRequested(payload, makeContext()),
    ).resolves.toBeUndefined();
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
        release: jest.fn().mockResolvedValue(undefined),
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
        release: jest.fn().mockResolvedValue(undefined),
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

describe('EventsController.handleParticipantReminderDispatch', () => {
  let controller: EventsController;
  let sendParticipantReminderEmail: jest.Mock;
  let emit: jest.Mock;

  const RECIPIENTS = [
    {
      participantId: 'p-1',
      userId: 'u-1',
      email: 'ada@example.com',
      fullName: 'Ada',
    },
    {
      participantId: 'p-2',
      userId: 'u-2',
      email: 'bob@example.com',
      fullName: 'Bob',
    },
  ];

  const payload = {
    reminderId: 'rem-1',
    programId: 'prog-1',
    programName: 'CYS 2026',
    brandId: 'brand-1',
    audience: 'registration_fee_unpaid',
    subject: 'Fee for {{program_name}}',
    body: 'Hi {{participant_name}}, please pay.',
    paymentsUrl: 'https://cys.example.com/dashboard/payments',
    recipients: RECIPIENTS,
    brand: { name: 'CYS', websiteUrl: 'https://cys.example.com' },
  };

  beforeEach(() => {
    sendParticipantReminderEmail = jest
      .fn()
      .mockResolvedValue({ data: { id: 'resend-1' } });
    emit = jest.fn().mockResolvedValue(true);
    controller = new EventsController(
      { sendParticipantReminderEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        shouldProcess: jest.fn().mockResolvedValue({
          shouldProcess: true,
          dedupeKey: 'key',
          reason: 'new',
        }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
      { emit } as unknown as RabbitMQProducerService,
    );
  });

  it('sends one email per recipient, passing the template through untouched', async () => {
    await controller.handleParticipantReminderDispatch(payload, makeContext());

    expect(sendParticipantReminderEmail).toHaveBeenCalledTimes(2);
    expect(sendParticipantReminderEmail).toHaveBeenCalledWith(
      'ada@example.com',
      expect.objectContaining({
        subject: 'Fee for {{program_name}}',
        body: 'Hi {{participant_name}}, please pay.',
        participantName: 'Ada',
        programName: 'CYS 2026',
        paymentsUrl: 'https://cys.example.com/dashboard/payments',
      }),
    );
  });

  it("one recipient's failure does not abort the rest", async () => {
    sendParticipantReminderEmail
      .mockRejectedValueOnce(new Error('mailbox full'))
      .mockResolvedValueOnce({ data: { id: 'resend-2' } });

    await controller.handleParticipantReminderDispatch(payload, makeContext());

    expect(sendParticipantReminderEmail).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith('reminder.participant.send_result', {
      reminderId: 'rem-1',
      programId: 'prog-1',
      results: [
        {
          participantId: 'p-1',
          providerMessageId: null,
          error: 'mailbox full',
        },
        { participantId: 'p-2', providerMessageId: 'resend-2', error: null },
      ],
    });
  });

  it('reports every outcome back to the API for the per-recipient send log', async () => {
    await controller.handleParticipantReminderDispatch(payload, makeContext());

    expect(emit).toHaveBeenCalledWith('reminder.participant.send_result', {
      reminderId: 'rem-1',
      programId: 'prog-1',
      results: [
        { participantId: 'p-1', providerMessageId: 'resend-1', error: null },
        { participantId: 'p-2', providerMessageId: 'resend-1', error: null },
      ],
    });
  });

  it('drops a malformed dispatch with no subject rather than mailing a blank', async () => {
    await controller.handleParticipantReminderDispatch(
      { ...payload, subject: '' },
      makeContext(),
    );

    expect(sendParticipantReminderEmail).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('sends nothing when the audience is empty', async () => {
    await controller.handleParticipantReminderDispatch(
      { ...payload, recipients: [] },
      makeContext(),
    );

    expect(sendParticipantReminderEmail).not.toHaveBeenCalled();
  });

  it('falls back to a generic salutation when full_name is blank', async () => {
    await controller.handleParticipantReminderDispatch(
      {
        ...payload,
        recipients: [{ ...RECIPIENTS[0], fullName: '' }],
      },
      makeContext(),
    );

    expect(sendParticipantReminderEmail).toHaveBeenCalledWith(
      'ada@example.com',
      expect.objectContaining({ participantName: 'Participant' }),
    );
  });

  it('does not fail the send when reporting results back fails', async () => {
    emit.mockRejectedValue(new Error('broker down'));

    await expect(
      controller.handleParticipantReminderDispatch(payload, makeContext()),
    ).resolves.toBeUndefined();
    expect(sendParticipantReminderEmail).toHaveBeenCalledTimes(2);
  });
});

describe('EventsController.processEvent — failed send retry', () => {
  const makeController = (sendVerificationEmail: jest.Mock) => {
    const idempotency = {
      shouldProcess: jest.fn().mockResolvedValue({
        shouldProcess: true,
        dedupeKey: 'verify-key',
        reason: 'new',
      }),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new EventsController(
      { sendVerificationEmail } as unknown as EmailService,
      {} as ReceiptService,
      idempotency as unknown as NotificationIdempotencyService,
      { emit: jest.fn() } as unknown as RabbitMQProducerService,
    );
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context = {
      getMessage: () => ({
        content: Buffer.from('{}'),
        properties: { headers: {} },
      }),
      getChannelRef: () => channel,
    } as unknown as RmqContext;
    return { controller, idempotency, channel, context };
  };
  const payload = { email: 'jane@example.com', token: 'tok-1', name: 'Jane' };

  it('releases the dedupe key before nacking so the DLX retry is not deduped', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(new Error('monthly_quota_exceeded'));
    const { controller, idempotency, channel, context } = makeController(send);

    await controller.handleVerifyEmail(payload, context);

    expect(idempotency.release).toHaveBeenCalledWith('verify-key');
    expect(channel.nack).toHaveBeenCalledTimes(1);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('does not release the key when the ack throws after a successful send', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const { controller, idempotency, channel, context } = makeController(send);
    channel.ack.mockImplementation(() => {
      throw new Error('Channel closed');
    });

    await expect(
      controller.handleVerifyEmail(payload, context),
    ).rejects.toThrow('Channel closed');

    expect(idempotency.release).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('keeps the dedupe key when the send succeeds', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const { controller, idempotency, channel, context } = makeController(send);

    await controller.handleVerifyEmail(payload, context);

    expect(idempotency.release).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});

describe('EventsController.handleEmailVerified', () => {
  it('acks without sending: the Welcome email from user.registered is the confirmation', () => {
    const emailService = { sendRawEmail: jest.fn(), sendWelcomeEmail: jest.fn() };
    const controller = new EventsController(
      emailService as unknown as EmailService,
      {} as ReceiptService,
      {} as NotificationIdempotencyService,
      { emit: jest.fn() } as unknown as RabbitMQProducerService,
    );
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context = {
      getMessage: () => ({ content: Buffer.from('{}'), properties: { headers: {} } }),
      getChannelRef: () => channel,
    } as unknown as RmqContext;

    controller.handleEmailVerified(context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(emailService.sendRawEmail).not.toHaveBeenCalled();
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
