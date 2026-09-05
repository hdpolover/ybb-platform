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
 * Eligibility rule: an application is eligible iff its status is `submitted` or
 * `accepted` AND there exists a RELEASED, non-deleted LOA release batch for the
 * program whose `[paymentFrom, paymentTo]` window contains one of the
 * application's PAYMENT dates (inclusive on both bounds).
 *
 * The window is matched against a paid invoice, not against `submittedAt`, and
 * that has to stay in step with how a batch CHOOSES its recipients
 * (buildLoaEligibleApplicationWhere). While the two disagreed, a batch selected
 * by payment date would notify someone whose submission fell outside the same
 * window, and this gate would then refuse them the download - an email saying
 * the letter is ready, followed by a refusal, on the one document people
 * actually chase. That failure is also invisible: it is not a 5xx, and support
 * cannot tell it apart from an unreleased batch.
 */
@Injectable()
export class LoaEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async checkEligibility(applicationId: string, programId: string): Promise<EligibilityResult> {
    const application = await this.prisma.participantApplication.findFirst({
      where: { id: applicationId },
      select: {
        status: true,
        submittedAt: true,
        // Every payment this application has made. A batch covers the
        // application if its window contains ANY of them - the same `some`
        // semantics the recipient query uses, so one payment before the window
        // and another inside it still counts as covered.
        invoices: {
          where: { status: 'paid', paidAt: { not: null } },
          select: { paidAt: true },
        },
      },
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

    // Never paid, so no window can cover them. Checked explicitly because an
    // empty OR list below would match every batch rather than none.
    const paidAts = application.invoices
      .map((invoice) => invoice.paidAt)
      .filter((paidAt): paidAt is Date => paidAt !== null);
    if (paidAts.length === 0) {
      return { eligible: false };
    }

    // Find a released, non-deleted batch whose window covers one of the payment
    // dates.
    const batch = await this.prisma.loaReleaseBatch.findFirst({
      where: {
        programId,
        deletedAt: null,
        releasedAt: { not: null },
        OR: paidAts.map((paidAt) => ({
          paymentFrom: { lte: paidAt },
          paymentTo: { gte: paidAt },
        })),
      },
      select: { id: true },
    });

    if (!batch) {
      return { eligible: false };
    }

    return { eligible: true, batchId: batch.id };
  }

  /**
   * Every application of this participant that could yield a Letter of
   * Acceptance right now, within one brand.
   *
   * Shared so the documents list and the download endpoint cannot disagree.
   * They used to: the list computed `downloadable` from a single brand-blind
   * lookup while the download evaluated all candidates and refused to guess, so
   * a participant could be shown a working link that failed. Because the link
   * is a plain `<a download>` with no error handling, that surfaced as the
   * browser saving the JSON error body as a file - on the one document people
   * submit to embassies.
   *
   * Withdrawn and soft-deleted applications are excluded outright: a withdrawn
   * application is not an acceptance. Scoped by brand, because a participant
   * with applications under two brands must not be served the other's letter.
   */
  async resolveEligibleApplications(
    participantId: string,
    brandId: string,
    programId?: string,
  ): Promise<Array<{ application: { id: string; programId: string }; batchId?: string }>> {
    const candidates = await this.prisma.participantApplication.findMany({
      where: {
        participantId,
        deletedAt: null,
        withdrawnAt: null,
        ...(programId ? { programId } : {}),
        ...(brandId ? { program: { brandId } } : {}),
      },
      select: { id: true, programId: true },
    });

    // Concurrent, not sequential: each check is two independent queries and the
    // candidate count is bounded by the participant's programme count.
    const checked = await Promise.all(
      candidates.map(async (application) => ({
        application,
        result: await this.checkEligibility(application.id, application.programId),
      })),
    );

    return checked
      .filter((entry) => entry.result.eligible)
      .map((entry) => ({ application: entry.application, batchId: entry.result.batchId }));
  }
}
