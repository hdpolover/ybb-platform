// src/modules/programs/presentation/loa-send-results.controller.ts
import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { acknowledgeRmqMessage } from '@shared/infrastructure/rabbitmq/rmq-ack';
import { LoaBatchRecipientSendRepository } from '../infrastructure/persistence/loa-batch-recipient-send.repository';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Consumes the per-recipient outcomes reported by services/notification after
 * it has attempted the LOA-ready email for one released batch, and writes
 * them onto the `pending` rows the release handler created up front.
 *
 * This exists because services/notification has no database access of its own
 * (no Prisma or pg dependency) — the API stays the single writer to its own
 * schema rather than a second Prisma client being bolted onto that service.
 */
@Controller()
export class LoaSendResultsController {
  private readonly logger = new Logger(LoaSendResultsController.name);

  constructor(private readonly recipientSendRepo: LoaBatchRecipientSendRepository) {}

  @EventPattern('loa.batch.send_result')
  async handleLoaBatchSendResult(
    @Payload() payload: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    // Ack up front, like PaymentEventsController: this is an audit write, so
    // redelivering it on failure would buy nothing (the emails have already
    // been sent and the next release re-reports anyway) while risking a
    // retry loop on a malformed payload.
    acknowledgeRmqMessage(context, this.logger, 'loa.batch.send_result', 'received');

    const data = asRecord(payload);
    const batchId = getString(data, 'batchId');
    const rawResults = Array.isArray(data.results) ? data.results : [];

    if (!batchId || rawResults.length === 0) {
      this.logger.warn(
        `[loa-batch] ignoring loa.batch.send_result with batchId=${batchId ?? 'missing'} results=${rawResults.length}`,
      );
      return;
    }

    let recorded = 0;
    let failed = 0;

    // Sequential and individually guarded: one unwritable row must not cost
    // the audit trail for the rest of the batch.
    for (const rawResult of rawResults) {
      const result = asRecord(rawResult);
      const participantId = getString(result, 'participantId');
      if (!participantId) continue;

      const error = getString(result, 'error') ?? null;

      try {
        await this.recipientSendRepo.recordResult({
          batchId,
          participantId,
          providerMessageId: getString(result, 'providerMessageId') ?? null,
          error,
        });
        recorded += 1;
        if (error) failed += 1;
      } catch (writeError) {
        this.logger.error(
          `[loa-batch] failed to record send result batch=${batchId} participant=${participantId}`,
          writeError instanceof Error ? writeError.stack : String(writeError),
        );
      }
    }

    this.logger.log(
      `[loa-batch] recorded ${recorded}/${rawResults.length} send results for batch=${batchId} (${failed} failed sends)`,
    );
  }
}
