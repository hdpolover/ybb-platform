import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { LoaBatchReleasedRecipient } from '../../../../common/types/events';

export interface CreateLoaBatchData {
  programId: string;
  name: string;
  submissionFrom: Date;
  submissionTo: Date;
  createdBy: string;
}

export interface UpdateLoaBatchData {
  name?: string;
  submissionFrom?: Date;
  submissionTo?: Date;
}

// Eligible = participant_applications with status in ('submitted', 'accepted')
// AND submittedAt within the batch window, for the batch's program, not deleted.
const ELIGIBLE_APPLICATION_STATUSES = ['submitted', 'accepted'] as const;

@Injectable()
export class LoaReleaseBatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProgram(programId: string) {
    return this.prisma.loaReleaseBatch.findMany({
      where: { programId, deletedAt: null },
      orderBy: { submissionFrom: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.loaReleaseBatch.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findOverlapping(
    programId: string,
    from: Date,
    to: Date,
    excludeId?: string,
  ) {
    return this.prisma.loaReleaseBatch.findMany({
      where: {
        programId,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        // overlap: existing.from <= to AND existing.to >= from
        submissionFrom: { lte: to },
        submissionTo: { gte: from },
      },
    });
  }

  async create(data: CreateLoaBatchData) {
    return this.prisma.loaReleaseBatch.create({ data });
  }

  async update(id: string, data: UpdateLoaBatchData) {
    return this.prisma.loaReleaseBatch.update({ where: { id }, data });
  }

  /**
   * Idempotent release: only sets releasedAt when it is currently null, so
   * re-releasing an already-released batch (double click, retried request)
   * is a no-op — reported via `transitioned: false` — instead of silently
   * refreshing the timestamp. Callers use `transitioned` to decide whether
   * this was a genuine unreleased→released transition worth notifying about.
   * The updateMany + re-fetch is atomic at the DB level (single UPDATE ...
   * WHERE released_at IS NULL), so concurrent release calls can't both see
   * transitioned: true.
   */
  async release(id: string) {
    const result = await this.prisma.loaReleaseBatch.updateMany({
      where: { id, releasedAt: null },
      data: { releasedAt: new Date() },
    });

    const batch = await this.prisma.loaReleaseBatch.findUniqueOrThrow({ where: { id } });
    return { batch, transitioned: result.count > 0 };
  }

  async unrelease(id: string) {
    return this.prisma.loaReleaseBatch.update({
      where: { id },
      data: { releasedAt: null },
    });
  }

  /**
   * Recipients eligible for LOA-ready notifications: submitted/accepted
   * applications in the batch's program whose submittedAt falls within the
   * batch window, joined through participant → user for email + full name.
   */
  async findEligibleRecipients(
    programId: string,
    submissionFrom: Date,
    submissionTo: Date,
  ): Promise<LoaBatchReleasedRecipient[]> {
    const applications = await this.prisma.participantApplication.findMany({
      where: {
        programId,
        status: { in: [...ELIGIBLE_APPLICATION_STATUSES] },
        submittedAt: { gte: submissionFrom, lte: submissionTo },
        deletedAt: null,
      },
      select: {
        participant: {
          select: {
            fullName: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    return applications.map((application) => ({
      userId: application.participant.user.id,
      email: application.participant.user.email,
      // Blank until onboarding completes; an LOA-release email addressed to
      // nobody reads worse than a generic salutation.
      fullName: application.participant.fullName || 'Participant',
    }));
  }

  async softDelete(id: string) {
    return this.prisma.loaReleaseBatch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
