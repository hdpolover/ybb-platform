import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

/**
 * Result of an LOA download eligibility check.
 *
 * When `eligible` is true, `batchId` identifies the released batch that grants
 * eligibility so callers can persist it as `participant_applications.loaReleaseBatchId`.
 */
export interface EligibilityResult {
  eligible: boolean;
  batchId?: string;
}

// Only submitted or accepted applications may download an LOA (spec §3).
const ELIGIBLE_APPLICATION_STATUSES = ['submitted', 'accepted'] as const;

/**
 * Determines whether a participant may download their Letter of Acceptance.
 *
 * Eligibility rule (spec §3 / §4.1): an application is eligible iff its status is
 * `submitted` or `accepted` AND there exists a RELEASED, non-deleted LOA release
 * batch for the program whose `[submissionFrom, submissionTo]` window contains the
 * application's `submittedAt` timestamp (inclusive on both bounds).
 */
@Injectable()
export class LoaEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async checkEligibility(applicationId: string, programId: string): Promise<EligibilityResult> {
    const application = await this.prisma.participantApplication.findFirst({
      where: { id: applicationId },
      select: { status: true, submittedAt: true },
    });

    // No application / wrong status / never submitted → not eligible (spec §11).
    if (!application) {
      return { eligible: false };
    }
    if (!ELIGIBLE_APPLICATION_STATUSES.includes(application.status as (typeof ELIGIBLE_APPLICATION_STATUSES)[number])) {
      return { eligible: false };
    }
    if (!application.submittedAt) {
      return { eligible: false };
    }

    // Find a released, non-deleted batch whose window covers the submission date.
    const batch = await this.prisma.loaReleaseBatch.findFirst({
      where: {
        programId,
        deletedAt: null,
        releasedAt: { not: null },
        submissionFrom: { lte: application.submittedAt },
        submissionTo: { gte: application.submittedAt },
      },
      select: { id: true },
    });

    if (!batch) {
      return { eligible: false };
    }

    return { eligible: true, batchId: batch.id };
  }
}
