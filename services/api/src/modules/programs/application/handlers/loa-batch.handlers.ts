import { CommandHandler, ICommandHandler, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { IUserNotificationRepository } from '@core/interfaces/repositories/user-notification.repository.interface';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { UserNotification } from '@core/entities/user-notification.entity';
import { LoaBatchReleasedPayload, LoaBatchReleasedRecipient } from '../../../../common/types/events';
import { LoaReleaseBatchRepository } from '../../infrastructure/persistence/loa-release-batch.repository';
import { LoaBatchRecipientSendRepository } from '../../infrastructure/persistence/loa-batch-recipient-send.repository';
import {
  CreateLoaBatchCommand,
  UpdateLoaBatchCommand,
  ReleaseLoaBatchCommand,
  UnreleaseLoaBatchCommand,
  DeleteLoaBatchCommand,
} from '../commands/loa-batch.commands';
import {
  GetLoaBatchesQuery,
  GetLoaDownloadsQuery,
  GetLoaBatchRecipientSendsQuery,
} from '../queries/loa-batch.queries';
import { LoaRecipientSendResponseDto } from '../dto/loa-batch.dto';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';
import { Prisma } from '@prisma/client';
import { assertProgramContentAccess } from '../../application/utils/program-content-access.util';

// ─── Program id/slug resolution ────────────────────────────────────────────────
// The admin dashboard's route param is frequently a program SLUG, not a UUID
// (useResolvedProgramId falls back to the raw route value whenever the program
// is not in the caller's accessiblePrograms - the normal steady state for a
// program-scoped admin viewing their own program, not just a first-paint race).
// A controller-level assertion on the raw param would 404 that admin - and a
// super admin too, since assertProgramAccess looks the row up by id before its
// platform-scope short-circuit. Resolved once per handler, then used for both
// the scope check and the rest of the handler's own queries - the batch
// handlers below previously compared existing.programId to the raw route value
// throughout, which already 404'd on a slug for update/release/unrelease/delete
// today; this fixes that same bug while adding the scope check.
async function resolveProgramId(
  repo: IProgramRepository,
  identifier: string,
): Promise<string | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (isUUID) return identifier;

  const program = await repo.findBySlug(identifier);
  return program ? program.id : null;
}

// The uncovered-applicant list rides along with every LOA batch read, so it is
// capped for payload size; the count returned beside it is the true total.
const UNCOVERED_PARTICIPANT_LIST_LIMIT = 100;
import { endOfWibDay, startOfWibDay } from '@shared/utils/wib-time';

// ─── LOA_DOCUMENT_TYPE ────────────────────────────────────────────────────────
// ParticipantDocument.type is a plain string column — no Prisma enum.
const LOA_DOCUMENT_TYPE = 'letter_of_acceptance';

// ─── Date window normalization ────────────────────────────────────────────────
// Admin UI sends whole-day picks (e.g. "12 Jul") as midnight UTC. Without
// normalization, submissionTo lands at the START of its day, which excludes
// every submission made later that same day from eligibility. Normalize the
// batch window server-side so it's always inclusive of both full WIB days
// (YBB's users are mostly WIB/UTC+7), using the shared wib-time helpers.

// ─── Command Handlers ─────────────────────────────────────────────────────────

@CommandHandler(CreateLoaBatchCommand)
export class CreateLoaBatchHandler implements ICommandHandler<CreateLoaBatchCommand> {
  constructor(
    private readonly batchRepo: LoaReleaseBatchRepository,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(command: CreateLoaBatchCommand) {
    const { name, adminUserId } = command;

    const programId = await resolveProgramId(this.programRepository, command.programId);
    if (!programId) {
      throw new NotFoundException(`Program ${command.programId} not found`);
    }
    await assertProgramContentAccess(this.prismaRead, command.actor, programId);

    const submissionFrom = startOfWibDay(command.submissionFrom);
    const submissionTo = endOfWibDay(command.submissionTo);

    if (submissionFrom > submissionTo) {
      throw new BadRequestException('submissionFrom must be on or before submissionTo');
    }

    const overlapping = await this.batchRepo.findOverlapping(programId, submissionFrom, submissionTo);
    if (overlapping.length > 0) {
      throw new ConflictException(
        `Batch date range overlaps with existing batch "${overlapping[0].name}"`,
      );
    }

    return this.batchRepo.create({ programId, name, submissionFrom, submissionTo, createdBy: adminUserId });
  }
}

@CommandHandler(UpdateLoaBatchCommand)
export class UpdateLoaBatchHandler implements ICommandHandler<UpdateLoaBatchCommand> {
  constructor(
    private readonly batchRepo: LoaReleaseBatchRepository,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(command: UpdateLoaBatchCommand) {
    const { batchId, name } = command;

    const programId = await resolveProgramId(this.programRepository, command.programId);
    if (!programId) {
      throw new NotFoundException('Batch not found');
    }
    await assertProgramContentAccess(this.prismaRead, command.actor, programId);

    const submissionFrom = command.submissionFrom ? startOfWibDay(command.submissionFrom) : undefined;
    const submissionTo = command.submissionTo ? endOfWibDay(command.submissionTo) : undefined;

    const existing = await this.batchRepo.findById(batchId);
    if (!existing || existing.programId !== programId) {
      throw new NotFoundException('Batch not found');
    }

    // Use incoming dates if provided, otherwise fall back to existing values for overlap check
    const from = submissionFrom ?? existing.submissionFrom;
    const to = submissionTo ?? existing.submissionTo;

    if (from > to) {
      throw new BadRequestException('submissionFrom must be on or before submissionTo');
    }

    const overlapping = await this.batchRepo.findOverlapping(programId, from, to, batchId);
    if (overlapping.length > 0) {
      throw new ConflictException(
        `Batch date range overlaps with existing batch "${overlapping[0].name}"`,
      );
    }

    return this.batchRepo.update(batchId, { name, submissionFrom, submissionTo });
  }
}

@CommandHandler(ReleaseLoaBatchCommand)
export class ReleaseLoaBatchHandler implements ICommandHandler<ReleaseLoaBatchCommand> {
  private readonly logger = new Logger(ReleaseLoaBatchHandler.name);

  constructor(
    private readonly batchRepo: LoaReleaseBatchRepository,
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly recipientSendRepo: LoaBatchRecipientSendRepository,
    @Inject(IUserNotificationRepository)
    private readonly userNotificationRepository: IUserNotificationRepository,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(command: ReleaseLoaBatchCommand) {
    const programId = await resolveProgramId(this.programRepository, command.programId);
    if (!programId) {
      throw new NotFoundException('Batch not found');
    }
    await assertProgramContentAccess(this.prismaRead, command.actor, programId);

    const existing = await this.batchRepo.findById(command.batchId);
    if (!existing || existing.programId !== programId) {
      throw new NotFoundException('Batch not found');
    }

    const { batch, transitioned } = await this.batchRepo.release(command.batchId);

    // Only notify on a genuine unreleased→released transition. Re-releasing
    // an already-released batch (double click, retried request) must NOT
    // re-notify every eligible participant — `transitioned` is what makes
    // this idempotent.
    if (transitioned) {
      // Best-effort: the release itself already committed above, so a
      // notification failure must not turn into a 500 for the admin (and
      // must not make them think the release failed and retry it — retrying
      // would just no-op on `transitioned` and never notify anyone).
      try {
        await this.notifyEligibleRecipients(batch);
      } catch (error) {
        this.logger.error(
          `[loa-batch] notify pipeline failed for batch=${batch.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return batch;
  }

  private async notifyEligibleRecipients(batch: {
    id: string;
    programId: string;
    name: string;
    submissionFrom: Date;
    submissionTo: Date;
  }): Promise<void> {
    const recipients = await this.batchRepo.findEligibleRecipients(
      batch.programId,
      batch.submissionFrom,
      batch.submissionTo,
    );

    if (recipients.length === 0) {
      this.logger.log(
        `[loa-batch] batch=${batch.id} released with 0 eligible recipients — skipping notify`,
      );
      return;
    }

    // In-app notifications are written directly here rather than by
    // services/notification: that service has no database access at all
    // (no Prisma dependency in its package.json) — it only sends email. This
    // reuses the one existing path that writes user_notifications today
    // (IUserNotificationRepository.create), same as list/mark-read use.
    await this.createInAppNotifications(batch, recipients);

    // Record the intended recipients BEFORE publishing, so "who was supposed
    // to get this letter?" is answerable even if the publish below fails, the
    // broker is down, or services/notification never reports back. The
    // outcomes are filled in later by LoaSendResultsController.
    await this.recordPendingSends(batch, recipients);

    const program = await this.prisma.program.findUnique({
      where: { id: batch.programId },
      select: {
        name: true,
        brand: { select: { name: true, websiteUrl: true } },
      },
    });

    const payload: LoaBatchReleasedPayload = {
      batchId: batch.id,
      programId: batch.programId,
      programName: program?.name ?? '',
      batchName: batch.name,
      recipients,
      brand: program?.brand
        ? { name: program.brand.name, websiteUrl: program.brand.websiteUrl }
        : null,
    };

    try {
      await this.rabbitmqProducer.emit('loa.batch.released', payload);
    } catch (error) {
      // In-app notifications above are already committed — a publish
      // failure here must not roll back the release. Log loudly; there's no
      // outbox for this event type (see PaymentOutboxService for that
      // pattern if guaranteed delivery becomes a requirement later).
      this.logger.error(
        `[loa-batch] failed to publish loa.batch.released for batch=${batch.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Best-effort: the audit log exists to explain the send, so it must never
   * be what stops one. A failure here is logged and the release/notify
   * pipeline continues — the batch still goes out, it just goes out
   * unlogged, which is strictly no worse than the pre-existing behaviour.
   */
  private async recordPendingSends(
    batch: { id: string; programId: string },
    recipients: LoaBatchReleasedRecipient[],
  ): Promise<void> {
    try {
      await this.recipientSendRepo.markPending(batch.id, batch.programId, recipients);
    } catch (error) {
      this.logger.error(
        `[loa-batch] failed to record ${recipients.length} pending send rows for batch=${batch.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async createInAppNotifications(
    batch: { id: string; name: string },
    recipients: LoaBatchReleasedRecipient[],
  ): Promise<void> {
    const documentsUrl = this.buildDocumentsUrl();

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.userNotificationRepository.create(
          new UserNotification(
            '',
            recipient.userId,
            'loa_available',
            'Invitation Letter Ready',
            `Your Invitation Letter for "${batch.name}" is ready. Log in to download it.`,
            documentsUrl,
            null,
            'loa_release_batch',
            batch.id,
            {},
            false,
            null,
            'normal',
            false,
            false,
            null,
            null,
            new Date(),
            null,
            null,
          ),
        ),
      ),
    );

    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(
        `[loa-batch] ${failures.length}/${recipients.length} in-app notification writes failed for batch=${batch.id}`,
      );
    }
  }

  private buildDocumentsUrl(): string {
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${baseUrl}/dashboard/documents`;
  }
}

@CommandHandler(UnreleaseLoaBatchCommand)
export class UnreleaseLoaBatchHandler implements ICommandHandler<UnreleaseLoaBatchCommand> {
  constructor(
    private readonly batchRepo: LoaReleaseBatchRepository,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(command: UnreleaseLoaBatchCommand) {
    const programId = await resolveProgramId(this.programRepository, command.programId);
    if (!programId) {
      throw new NotFoundException('Batch not found');
    }
    await assertProgramContentAccess(this.prismaRead, command.actor, programId);

    const batch = await this.batchRepo.findById(command.batchId);
    if (!batch || batch.programId !== programId) {
      throw new NotFoundException('Batch not found');
    }
    return this.batchRepo.unrelease(command.batchId);
  }
}

@CommandHandler(DeleteLoaBatchCommand)
export class DeleteLoaBatchHandler implements ICommandHandler<DeleteLoaBatchCommand> {
  constructor(
    private readonly batchRepo: LoaReleaseBatchRepository,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(command: DeleteLoaBatchCommand) {
    const programId = await resolveProgramId(this.programRepository, command.programId);
    if (!programId) {
      throw new NotFoundException('Batch not found');
    }
    await assertProgramContentAccess(this.prismaRead, command.actor, programId);

    const batch = await this.batchRepo.findById(command.batchId);
    if (!batch || batch.programId !== programId) {
      throw new NotFoundException('Batch not found');
    }
    return this.batchRepo.softDelete(command.batchId);
  }
}

// ─── Query Handlers ───────────────────────────────────────────────────────────

@QueryHandler(GetLoaBatchesQuery)
export class GetLoaBatchesHandler implements IQueryHandler<GetLoaBatchesQuery> {
  constructor(
    private readonly batchRepo: LoaReleaseBatchRepository,
    private readonly prisma: PrismaService,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(query: GetLoaBatchesQuery) {
    // Admin-only route (@Roles), previously unscoped, and previously degraded
    // silently to an empty list for a slug (findByProgram never matched). Now
    // resolved once and used throughout.
    const programId = await resolveProgramId(this.programRepository, query.programId);
    if (!programId) return [];
    await assertProgramContentAccess(this.prismaRead, query.actor, programId);

    const batches = await this.batchRepo.findByProgram(programId);

    return Promise.all(
      batches.map(async (batch) => {
        const [eligibleCount, downloadedCount] = await Promise.all([
          // Eligible: submitted or accepted applications whose submittedAt falls within batch window
          this.prisma.participantApplication.count({
            where: {
              programId,
              status: { in: ['submitted', 'accepted'] },
              submittedAt: { gte: batch.submissionFrom, lte: batch.submissionTo },
            },
          }),
          // Downloaded: LOA documents linked to this batch with at least one download
          this.prisma.participantDocument.count({
            where: {
              loaReleaseBatchId: batch.id,
              downloadCount: { gt: 0 },
            },
          }),
        ]);

        return { ...batch, eligibleCount, downloadedCount };
      }),
    );
  }
}

@QueryHandler(GetLoaDownloadsQuery)
export class GetLoaDownloadsHandler implements IQueryHandler<GetLoaDownloadsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(query: GetLoaDownloadsQuery) {
    const programId = await resolveProgramId(this.programRepository, query.programId);
    if (!programId) return [];
    await assertProgramContentAccess(this.prismaRead, query.actor, programId);

    const docs = await this.prisma.participantDocument.findMany({
      where: {
        type: LOA_DOCUMENT_TYPE,
        application: { programId },
      },
      include: {
        application: {
          include: {
            participant: {
              include: {
                user: { select: { email: true } },
              },
            },
          },
        },
        loaReleaseBatch: { select: { name: true } },
      },
      orderBy: { firstDownloadedAt: 'desc' },
    });

    return docs.map((doc) => ({
      participantName: doc.application.participant.fullName,
      email: doc.application.participant.user.email,
      batchName: doc.loaReleaseBatch?.name ?? null,
      documentNumber: doc.documentNumber ?? '',
      firstDownloadedAt: doc.firstDownloadedAt,
      downloadCount: doc.downloadCount,
    }));
  }
}

@QueryHandler(GetLoaBatchRecipientSendsQuery)
export class GetLoaBatchRecipientSendsHandler
  implements IQueryHandler<GetLoaBatchRecipientSendsQuery>
{
  constructor(
    private readonly batchRepo: LoaReleaseBatchRepository,
    private readonly recipientSendRepo: LoaBatchRecipientSendRepository,
    private readonly prisma: PrismaService,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(query: GetLoaBatchRecipientSendsQuery) {
    const programId = await resolveProgramId(this.programRepository, query.programId);
    if (!programId) {
      throw new NotFoundException('Batch not found');
    }
    await assertProgramContentAccess(this.prismaRead, query.actor, programId);

    const batch = await this.batchRepo.findById(query.batchId);
    if (!batch || batch.programId !== programId) {
      throw new NotFoundException('Batch not found');
    }

    const [sends, uncovered] = await Promise.all([
      this.recipientSendRepo.findByBatch(query.batchId),
      this.summariseUncoveredParticipants(programId),
    ]);

    const recipients = await this.attachParticipantNames(sends);

    const summary = sends.reduce(
      (counts, send) => ({
        ...counts,
        total: counts.total + 1,
        [send.status]: (counts[send.status as 'pending' | 'sent' | 'failed'] ?? 0) + 1,
      }),
      { total: 0, pending: 0, sent: 0, failed: 0 },
    );

    return {
      batchId: batch.id,
      // A released batch with no rows predates this log; an unreleased batch
      // has simply not fanned out yet. Both render as "not recorded", but
      // only the first is a gap in the audit trail.
      hasSendLog: sends.length > 0,
      summary,
      recipients,
      ...uncovered,
    };
  }

  /**
   * The send log deliberately stores no name (it snapshots the email address
   * because that is what delivery used, but a name is only ever display
   * chrome). Resolved here in one extra query rather than via a Prisma
   * relation, so the new table needs no foreign key to participants.
   */
  private async attachParticipantNames(
    sends: Array<{
      participantId: string;
      email: string;
      status: string;
      providerMessageId: string | null;
      errorMessage: string | null;
      attemptCount: number;
      sentAt: Date | null;
    }>,
  ): Promise<LoaRecipientSendResponseDto[]> {
    if (sends.length === 0) {
      return [];
    }

    const participants = await this.prisma.participant.findMany({
      where: { id: { in: sends.map((send) => send.participantId) } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(participants.map((p) => [p.id, p.fullName]));

    return sends.map((send) => ({
      participantId: send.participantId,
      // full_name is '' (not null) until onboarding completes — an empty cell
      // reads as a bug, so fall back to the address we actually mailed.
      participantName: nameById.get(send.participantId) || send.email,
      email: send.email,
      status: send.status as LoaRecipientSendResponseDto['status'],
      providerMessageId: send.providerMessageId,
      errorMessage: send.errorMessage,
      attemptCount: send.attemptCount,
      sentAt: send.sentAt,
    }));
  }

  /**
   * Closes the silent-exclusion blind spot. An applicant whose submittedAt
   * falls outside every RELEASED batch window is never returned by
   * findEligibleRecipients, so they get no email, no log line and no
   * send-log row — a per-recipient log alone cannot catch them, because they
   * were never a recipient. Observed in production: one applicant on China
   * Youth Summit 2026 (submitted 2026-08-28) sits outside all released
   * windows, and because createLoaBatch rejects overlapping ranges the gap
   * cannot simply be papered over with a wider batch later.
   *
   * Coverage is computed against RELEASED batches only — an unreleased batch
   * notifies nobody. But an admin staring at "1 uncovered" is very likely
   * looking at a batch they believe they already released, so an unreleased
   * batch that WOULD cover some of them is reported alongside.
   */
  private async summariseUncoveredParticipants(programId: string) {
    const batches = await this.prisma.loaReleaseBatch.findMany({
      where: { programId, deletedAt: null },
      select: {
        id: true,
        name: true,
        submissionFrom: true,
        submissionTo: true,
        releasedAt: true,
      },
    });

    const toWindow = (batch: { submissionFrom: Date; submissionTo: Date }) => ({
      submittedAt: { gte: batch.submissionFrom, lte: batch.submissionTo },
    });
    const releasedBatches = batches.filter((batch) => batch.releasedAt !== null);
    const unreleasedBatches = batches.filter((batch) => batch.releasedAt === null);

    const uncoveredWhere = {
      programId,
      status: { in: ['submitted', 'accepted'] },
      deletedAt: null,
      submittedAt: { not: null },
      // Deactivated/deleted accounts are excluded from the automated email,
      // so listing them here as "missed" would be a false alarm — same
      // predicate findEligibleRecipients uses.
      participant: ACTIVE_PARTICIPANT_WHERE,
      // No released batch at all -> every submitted applicant is uncovered.
      ...(releasedBatches.length > 0
        ? { NOT: { OR: releasedBatches.map(toWindow) } }
        : {}),
    } satisfies Prisma.ParticipantApplicationWhereInput;

    const [count, applications, coveredByUnreleasedCount] = await Promise.all([
      this.prisma.participantApplication.count({ where: uncoveredWhere }),
      this.prisma.participantApplication.findMany({
        where: uncoveredWhere,
        // Capped: this rides along with every batch read, and an admin acting
        // on the gap needs the earliest few, not an unbounded dump. `count`
        // above is the honest total.
        take: UNCOVERED_PARTICIPANT_LIST_LIMIT,
        orderBy: { submittedAt: 'asc' },
        select: {
          id: true,
          submittedAt: true,
          participant: {
            select: {
              id: true,
              fullName: true,
              user: { select: { email: true } },
            },
          },
        },
      }),
      unreleasedBatches.length > 0
        ? this.prisma.participantApplication.count({
            where: { ...uncoveredWhere, OR: unreleasedBatches.map(toWindow) },
          })
        : Promise.resolve(0),
    ]);

    return {
      uncoveredParticipantCount: count,
      uncoveredParticipants: applications.map((application) => ({
        applicationId: application.id,
        participantId: application.participant.id,
        // full_name is '' (not null) until onboarding completes.
        participantName: application.participant.fullName || application.participant.user.email,
        email: application.participant.user.email,
        submittedAt: application.submittedAt,
      })),
      coveredByUnreleasedBatchCount: coveredByUnreleasedCount,
      unreleasedBatchNames:
        coveredByUnreleasedCount > 0 ? unreleasedBatches.map((batch) => batch.name) : [],
    };
  }
}
