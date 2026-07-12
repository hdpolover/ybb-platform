import { CommandHandler, ICommandHandler, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LoaReleaseBatchRepository } from '../../infrastructure/persistence/loa-release-batch.repository';
import {
  CreateLoaBatchCommand,
  UpdateLoaBatchCommand,
  ReleaseLoaBatchCommand,
  UnreleaseLoaBatchCommand,
  DeleteLoaBatchCommand,
} from '../commands/loa-batch.commands';
import { GetLoaBatchesQuery, GetLoaDownloadsQuery } from '../queries/loa-batch.queries';

// ─── LOA_DOCUMENT_TYPE ────────────────────────────────────────────────────────
// ParticipantDocument.type is a plain string column — no Prisma enum.
const LOA_DOCUMENT_TYPE = 'letter_of_acceptance';

// ─── Date window normalization ────────────────────────────────────────────────
// Admin UI sends whole-day picks (e.g. "12 Jul") as midnight UTC. Without
// normalization, submissionTo lands at the START of its day, which excludes
// every submission made later that same day from eligibility. Normalize the
// batch window server-side so it's always inclusive of both full UTC days,
// regardless of what the client sends. Pure Date math, immutable (returns a
// new Date, does not mutate the input).
//
// Known limitation: this normalizes on UTC day boundaries. YBB's users are
// mostly WIB (UTC+7), so a submission in the few UTC-hours around local
// midnight can still fall just outside the window. Accepted for now —
// full timezone-awareness is out of scope for this fix.
function startOfUtcDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function endOfUtcDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(23, 59, 59, 999);
  return normalized;
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

@CommandHandler(CreateLoaBatchCommand)
export class CreateLoaBatchHandler implements ICommandHandler<CreateLoaBatchCommand> {
  constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

  async execute(command: CreateLoaBatchCommand) {
    const { programId, name, adminUserId } = command;
    const submissionFrom = startOfUtcDay(command.submissionFrom);
    const submissionTo = endOfUtcDay(command.submissionTo);

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
  constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

  async execute(command: UpdateLoaBatchCommand) {
    const { batchId, programId, name } = command;
    const submissionFrom = command.submissionFrom ? startOfUtcDay(command.submissionFrom) : undefined;
    const submissionTo = command.submissionTo ? endOfUtcDay(command.submissionTo) : undefined;

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
  constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

  async execute(command: ReleaseLoaBatchCommand) {
    const batch = await this.batchRepo.findById(command.batchId);
    if (!batch || batch.programId !== command.programId) {
      throw new NotFoundException('Batch not found');
    }
    return this.batchRepo.release(command.batchId);
  }
}

@CommandHandler(UnreleaseLoaBatchCommand)
export class UnreleaseLoaBatchHandler implements ICommandHandler<UnreleaseLoaBatchCommand> {
  constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

  async execute(command: UnreleaseLoaBatchCommand) {
    const batch = await this.batchRepo.findById(command.batchId);
    if (!batch || batch.programId !== command.programId) {
      throw new NotFoundException('Batch not found');
    }
    return this.batchRepo.unrelease(command.batchId);
  }
}

@CommandHandler(DeleteLoaBatchCommand)
export class DeleteLoaBatchHandler implements ICommandHandler<DeleteLoaBatchCommand> {
  constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

  async execute(command: DeleteLoaBatchCommand) {
    const batch = await this.batchRepo.findById(command.batchId);
    if (!batch || batch.programId !== command.programId) {
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
  ) {}

  async execute(query: GetLoaBatchesQuery) {
    const batches = await this.batchRepo.findByProgram(query.programId);

    return Promise.all(
      batches.map(async (batch) => {
        const [eligibleCount, downloadedCount] = await Promise.all([
          // Eligible: submitted or accepted applications whose submittedAt falls within batch window
          this.prisma.participantApplication.count({
            where: {
              programId: query.programId,
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
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetLoaDownloadsQuery) {
    const docs = await this.prisma.participantDocument.findMany({
      where: {
        type: LOA_DOCUMENT_TYPE,
        application: { programId: query.programId },
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
