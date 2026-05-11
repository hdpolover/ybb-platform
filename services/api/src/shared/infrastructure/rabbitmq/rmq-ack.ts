import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

type RmqAckChannel = {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo?: boolean, requeue?: boolean): void;
};

type AckLogger = Pick<Logger, 'error'>;

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

  channel.ack(message);
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

  channel.nack(message, false, false);
  return true;
}
