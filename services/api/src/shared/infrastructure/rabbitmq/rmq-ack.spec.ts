import { acknowledgeRmqMessage, rejectRmqMessageForRetry, ackRmqMessageOnce } from './rmq-ack';

/**
 * Guards the double-ack fix: when two chained @EventPattern handlers (from
 * different controllers) settle the SAME message object, only the first settle
 * reaches the broker. Prevents "unknown delivery tag" channel flaps.
 */
describe('rmq-ack idempotent settle', () => {
  const logger = { error: jest.fn(), warn: jest.fn() };

  function makeContext(message: object, channel: { ack: jest.Mock; nack: jest.Mock }) {
    return {
      getMessage: () => message,
      getChannelRef: () => channel,
    } as never;
  }

  it('acks once, then skips the second ack on the same message', () => {
    const message = { content: Buffer.from('x') };
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const ctx = makeContext(message, channel);

    expect(acknowledgeRmqMessage(ctx, logger, 'user.registered', 'a')).toBe(true);
    expect(acknowledgeRmqMessage(ctx, logger, 'user.registered', 'b')).toBe(true);

    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('does not nack a message that was already acked', () => {
    const message = { content: Buffer.from('y') };
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const ctx = makeContext(message, channel);

    acknowledgeRmqMessage(ctx, logger, 'payment.succeeded', 'a');
    rejectRmqMessageForRetry(ctx, logger, 'payment.succeeded');

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('settles distinct messages independently', () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    acknowledgeRmqMessage(makeContext({ id: 1 }, channel), logger, 'e', 'a');
    acknowledgeRmqMessage(makeContext({ id: 2 }, channel), logger, 'e', 'a');
    expect(channel.ack).toHaveBeenCalledTimes(2);
  });

  it('ackRmqMessageOnce is idempotent for the drop path', () => {
    const message = { content: Buffer.from('z') };
    const channel = { ack: jest.fn(), nack: jest.fn() };
    ackRmqMessageOnce(channel, message);
    ackRmqMessageOnce(channel, message);
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});
