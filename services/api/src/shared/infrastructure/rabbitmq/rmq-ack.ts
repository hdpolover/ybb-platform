import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

type RmqAckChannel = {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo?: boolean, requeue?: boolean): void;
};

type AckLogger = Pick<Logger, 'error' | 'warn'>;

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

  try {
    channel.ack(message);
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

  try {
    channel.nack(message, false, false);
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
