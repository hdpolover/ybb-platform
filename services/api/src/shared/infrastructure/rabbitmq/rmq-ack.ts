import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

type RmqAckChannel = {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo?: boolean, requeue?: boolean): void;
};

type AckLogger = Pick<Logger, 'error' | 'warn'>;

/**
 * Marks an amqplib message as already ack/nack-settled.
 *
 * Each NestJS microservice registers EVERY @EventPattern handler in the app, so a
 * routing key declared in more than one controller (e.g. AuditController and
 * ReportingController both handle `user.registered`, `payment.succeeded`, ...) is
 * chained via handler.next and NestJS invokes BOTH handlers with the SAME
 * RmqContext. Each handler then settles the message, producing a double ack on the
 * same delivery tag -> broker raises PRECONDITION_FAILED "unknown delivery tag",
 * closes the channel, and the consumer reconnect-loops.
 *
 * Guard: settle each message object at most once. The chained handlers share the
 * same message object, so the second settle becomes a no-op.
 */
const SETTLED = Symbol.for('ybb.rmq.message.settled');

function isSettled(message: unknown): boolean {
  return Boolean(message && (message as Record<symbol, unknown>)[SETTLED]);
}

function markSettled(message: unknown): void {
  if (message && typeof message === 'object') {
    (message as Record<symbol, unknown>)[SETTLED] = true;
  }
}

export function acknowledgeRmqMessage(
  context: RmqContext,
  logger: AckLogger,
  eventType: string,
  reason: string,
): boolean {
  const message = context.getMessage();
  const channel = context.getChannelRef() as RmqAckChannel | undefined;

  if (!message || !channel) {
    logger.error(`[rabbitmq-ack] unable to ack event=${eventType} reason=${reason}`);
    return false;
  }

  // Already ack/nack-settled by a chained handler on the same message — skip to
  // avoid a double-ack that closes the channel with "unknown delivery tag".
  if (isSettled(message)) {
    return true;
  }

  try {
    channel.ack(message);
    markSettled(message);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(
      `[rabbitmq-ack] ack failed (swallowed) event=${eventType} code=${code} message="${msg}" — broker will redeliver`,
    );
    return false;
  }
  return true;
}

export function rejectRmqMessageForRetry(
  context: RmqContext,
  logger: AckLogger,
  eventType: string,
): boolean {
  const message = context.getMessage();
  const channel = context.getChannelRef() as RmqAckChannel | undefined;

  if (!message || !channel) {
    logger.error(`[rabbitmq-retry] unable to nack event=${eventType}`);
    return false;
  }

  if (isSettled(message)) {
    return true;
  }

  try {
    channel.nack(message, false, false);
    markSettled(message);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(
      `[rabbitmq-retry] nack failed (swallowed) event=${eventType} code=${code} message="${msg}" — broker will redeliver`,
    );
    return false;
  }
  return true;
}

/**
 * Idempotent ack for callers that hold a raw channel + message directly (e.g. the
 * AckDropRmqServer drop path) rather than going through acknowledgeRmqMessage.
 */
export function ackRmqMessageOnce(channel: RmqAckChannel, message: unknown): void {
  if (!channel || !message || isSettled(message)) {
    return;
  }
  channel.ack(message);
  markSettled(message);
}
