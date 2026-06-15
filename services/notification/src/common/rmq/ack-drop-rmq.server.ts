import { Logger } from '@nestjs/common';
import { ServerRMQ } from '@nestjs/microservices';
import { RmqContext } from '@nestjs/microservices';
import { ReadPacket } from '@nestjs/microservices/interfaces/packet.interface';

/**
 * AckDropRmqServer extends ServerRMQ to change the default behavior for
 * unhandled event patterns.
 *
 * Default NestJS behavior: nack(msg, false, false) → routes to <queue>.retry
 * (15s TTL) → dead-letters back to main queue → infinite nack/retry cycle.
 *
 * Fixed behavior: when no @EventPattern handler is registered for a pattern,
 * ACK the message (drop it silently) instead of nacking it.
 */
export class AckDropRmqServer extends ServerRMQ {
  private readonly ackDropLogger = new Logger(AckDropRmqServer.name);

  override async handleEvent(
    pattern: string,
    packet: ReadPacket,
    context: RmqContext,
  ): Promise<any> {
    const handler = this.getHandlerByPattern(pattern);

    if (!handler) {
      try {
        context.getChannelRef().ack(context.getMessage());
      } catch {
        // Stale delivery tag (e.g. channel already closed) would throw 406.
        // Safe to swallow: the broker will handle the message regardless.
      }
      this.ackDropLogger.debug(
        `[AckDropRmqServer] dropped unhandled event: ${pattern}`,
      );
      return;
    }

    return super.handleEvent(pattern, packet, context);
  }
}
