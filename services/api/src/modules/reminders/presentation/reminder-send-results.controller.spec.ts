// src/modules/reminders/presentation/reminder-send-results.controller.spec.ts
import { RmqContext } from '@nestjs/microservices';
import { ReminderSendResultsController } from './reminder-send-results.controller';
import { ParticipantReminderSendRepository } from '../infrastructure/persistence/participant-reminder-send.repository';

const makeContext = (): RmqContext =>
  ({
    getMessage: () => ({ content: Buffer.from('{}'), properties: { headers: {} } }),
    getChannelRef: () => ({ ack: jest.fn(), nack: jest.fn() }),
  }) as unknown as RmqContext;

describe('ReminderSendResultsController', () => {
  let recordResult: jest.Mock;
  let controller: ReminderSendResultsController;

  beforeEach(() => {
    recordResult = jest.fn().mockResolvedValue(undefined);
    controller = new ReminderSendResultsController({
      recordResult,
    } as unknown as ParticipantReminderSendRepository);
  });

  it('records a success with its provider message id and no error', async () => {
    await controller.handleReminderSendResult(
      {
        reminderId: 'rem-1',
        programId: 'prog-1',
        results: [{ participantId: 'p-1', providerMessageId: 'resend-1', error: null }],
      },
      makeContext(),
    );

    expect(recordResult).toHaveBeenCalledWith({
      reminderId: 'rem-1',
      participantId: 'p-1',
      providerMessageId: 'resend-1',
      error: null,
    });
  });

  it('records a failure with its message', async () => {
    await controller.handleReminderSendResult(
      {
        reminderId: 'rem-1',
        programId: 'prog-1',
        results: [
          { participantId: 'p-2', providerMessageId: null, error: 'mailbox full' },
        ],
      },
      makeContext(),
    );

    expect(recordResult).toHaveBeenCalledWith({
      reminderId: 'rem-1',
      participantId: 'p-2',
      providerMessageId: null,
      error: 'mailbox full',
    });
  });

  it('ignores a payload with no reminderId rather than throwing', async () => {
    await controller.handleReminderSendResult({ results: [{}] }, makeContext());

    expect(recordResult).not.toHaveBeenCalled();
  });

  it('keeps recording the rest of the batch when one row fails to write', async () => {
    recordResult
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(undefined);

    await controller.handleReminderSendResult(
      {
        reminderId: 'rem-1',
        programId: 'prog-1',
        results: [
          { participantId: 'p-1', providerMessageId: 'a', error: null },
          { participantId: 'p-2', providerMessageId: 'b', error: null },
        ],
      },
      makeContext(),
    );

    expect(recordResult).toHaveBeenCalledTimes(2);
  });

  it('skips a result with no participantId — there is nothing to correlate it to', async () => {
    await controller.handleReminderSendResult(
      { reminderId: 'rem-1', programId: 'prog-1', results: [{ error: null }] },
      makeContext(),
    );

    expect(recordResult).not.toHaveBeenCalled();
  });
});
