// src/modules/programs/presentation/loa-send-results.controller.spec.ts
import { RmqContext } from '@nestjs/microservices';
import { LoaSendResultsController } from './loa-send-results.controller';
import { LoaBatchRecipientSendRepository } from '../infrastructure/persistence/loa-batch-recipient-send.repository';

const makeContext = (): RmqContext =>
  ({
    getMessage: () => ({ content: Buffer.from('{}'), properties: { headers: {} } }),
    getChannelRef: () => ({ ack: jest.fn(), nack: jest.fn() }),
  }) as unknown as RmqContext;

describe('LoaSendResultsController', () => {
  let recordResult: jest.Mock;
  let controller: LoaSendResultsController;

  beforeEach(() => {
    recordResult = jest.fn().mockResolvedValue(undefined);
    controller = new LoaSendResultsController({
      recordResult,
    } as unknown as LoaBatchRecipientSendRepository);
  });

  it('records a success with its provider message id and no error', async () => {
    await controller.handleLoaBatchSendResult(
      {
        batchId: 'batch-1',
        programId: 'prog-1',
        results: [
          { participantId: 'p-1', providerMessageId: 'resend-1', error: null },
        ],
      },
      makeContext(),
    );

    expect(recordResult).toHaveBeenCalledWith({
      batchId: 'batch-1',
      participantId: 'p-1',
      providerMessageId: 'resend-1',
      error: null,
    });
  });

  it('records a failure with its error message', async () => {
    await controller.handleLoaBatchSendResult(
      {
        batchId: 'batch-1',
        programId: 'prog-1',
        results: [
          { participantId: 'p-2', providerMessageId: null, error: 'mailbox full' },
        ],
      },
      makeContext(),
    );

    expect(recordResult).toHaveBeenCalledWith({
      batchId: 'batch-1',
      participantId: 'p-2',
      providerMessageId: null,
      error: 'mailbox full',
    });
  });

  it('keeps recording the remaining results when one row write throws', async () => {
    recordResult
      .mockRejectedValueOnce(new Error('deadlock'))
      .mockResolvedValueOnce(undefined);

    await expect(
      controller.handleLoaBatchSendResult(
        {
          batchId: 'batch-1',
          programId: 'prog-1',
          results: [
            { participantId: 'p-1', providerMessageId: 'a', error: null },
            { participantId: 'p-2', providerMessageId: 'b', error: null },
          ],
        },
        makeContext(),
      ),
    ).resolves.not.toThrow();

    expect(recordResult).toHaveBeenCalledTimes(2);
  });

  it('ignores a payload with no batchId rather than throwing', async () => {
    await expect(
      controller.handleLoaBatchSendResult(
        { results: [{ participantId: 'p-1', error: null }] },
        makeContext(),
      ),
    ).resolves.not.toThrow();

    expect(recordResult).not.toHaveBeenCalled();
  });

  it('skips result entries carrying no participantId', async () => {
    await controller.handleLoaBatchSendResult(
      {
        batchId: 'batch-1',
        programId: 'prog-1',
        results: [{ providerMessageId: 'x', error: null }, { participantId: 'p-1', error: null }],
      },
      makeContext(),
    );

    expect(recordResult).toHaveBeenCalledTimes(1);
    expect(recordResult).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'p-1' }),
    );
  });

  it('acks the message so an audit write never retry-loops the broker', async () => {
    const ack = jest.fn();
    const context = {
      getMessage: () => ({ content: Buffer.from('{}'), properties: { headers: {} } }),
      getChannelRef: () => ({ ack, nack: jest.fn() }),
    } as unknown as RmqContext;

    await controller.handleLoaBatchSendResult(
      { batchId: 'batch-1', results: [{ participantId: 'p-1', error: null }] },
      context,
    );

    expect(ack).toHaveBeenCalledTimes(1);
  });
});
