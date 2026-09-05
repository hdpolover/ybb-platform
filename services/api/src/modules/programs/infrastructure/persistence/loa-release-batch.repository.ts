import { Injectable } from '@nestjs/common';
import { Prisma, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { LoaBatchReleasedRecipient } from '../../../../common/types/events';
import { ACTIVE_PARTICIPANT_WHERE } from '../../../../shared/utils/active-participant.filter';

// paymentFrom/paymentTo (DB columns payment_from/payment_to) are the
// admin-chosen boundary dates of the batch's PAYMENT window. They are
// compared against the participant's payment date (see
// buildLoaEligibleApplicationWhere below), not the application's
// submittedAt - an admin manually submitting a late-paying participant
// stamps today's submission date, which would fall outside the window even
// though the person paid months ago, inside it.
export interface CreateLoaBatchData {
  programId: string;
  name: string;
  paymentFrom: Date;
  paymentTo: Date;
  createdBy: string;
}

export interface UpdateLoaBatchData {
  name?: string;
  paymentFrom?: Date;
  paymentTo?: Date;
}

// Eligible = participant_applications with status in ('submitted', 'accepted'),
// for the batch's program, not deleted, whose participant is still active,
// AND paid (any invoice, any fee type) within the batch window. See
// buildLoaEligibleApplicationWhere - every call site that decides "is this
// application in scope for this batch" MUST route through it, so the
// recipient list, the eligible count, and the uncovered-participant summary
// can never again disagree about who counts (audit item M10: they used to).
const ELIGIBLE_APPLICATION_STATUSES = ['submitted', 'accepted'] as const;

/**
 * The non-window part of eligibility: status + program + not-deleted +
 * active participant. Shared by the window predicate below and by the
 * uncovered-participant summary, which needs the same base filter but a
 * negated/OR'd window across multiple batches instead of one.
 */
export function loaEligibleBaseWhere(programId: string): Prisma.ParticipantApplicationWhereInput {
  return {
    programId,
    status: { in: [...ELIGIBLE_APPLICATION_STATUSES] },
    deletedAt: null,
    // Deactivated/deleted accounts stay in the applications list for
    // history but never get the automated LOA-ready email.
    participant: ACTIVE_PARTICIPANT_WHERE,
  };
}

/**
 * "Paid within [windowFrom, windowTo]" = has at least one PAID invoice whose
 * paidAt falls in that range. paidAt lives on ApplicationInvoice, not on the
 * application, so this is a relation filter rather than a plain column
 * comparison.
 *
 * "At least one paid invoice in window" vs. "earliest paid invoice in
 * window": for a window-membership check these are equivalent by design
 * here, not just by accident. An application with one paid invoice BEFORE
 * the window and another INSIDE it should still count - they paid within
 * the window, full stop, even though an earlier payment also exists outside
 * it. `some` captures exactly that. An application whose paid invoices are
 * ALL outside the window (all before, or all after) correctly does not
 * match.
 *
 * Verified against production that "any paid invoice" and "registration-fee
 * invoice only" give identical results, so this deliberately does not
 * restrict by fee type - a programme with no registration-fee tier still
 * works.
 */
export function loaPaymentWindowFilter(
  windowFrom: Date,
  windowTo: Date,
): Prisma.ParticipantApplicationWhereInput {
  return {
    invoices: {
      some: {
        status: PaymentStatus.paid,
        paidAt: { gte: windowFrom, lte: windowTo },
      },
    },
  };
}

/** The one shared predicate: eligible base + paid-within-window. */
export function buildLoaEligibleApplicationWhere(
  programId: string,
  windowFrom: Date,
  windowTo: Date,
): Prisma.ParticipantApplicationWhereInput {
  return {
    ...loaEligibleBaseWhere(programId),
    ...loaPaymentWindowFilter(windowFrom, windowTo),
  };
}

@Injectable()
export class LoaReleaseBatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProgram(programId: string) {
    return this.prisma.loaReleaseBatch.findMany({
      where: { programId, deletedAt: null },
      orderBy: { paymentFrom: 'asc' },
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
        paymentFrom: { lte: to },
        paymentTo: { gte: from },
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
   * applications in the batch's program that PAID within the batch window
   * (see buildLoaEligibleApplicationWhere), joined through participant →
   * user for email + full name.
   */
  async findEligibleRecipients(
    programId: string,
    paymentFrom: Date,
    paymentTo: Date,
  ): Promise<LoaBatchReleasedRecipient[]> {
    const applications = await this.prisma.participantApplication.findMany({
      where: buildLoaEligibleApplicationWhere(programId, paymentFrom, paymentTo),
      select: {
        participant: {
          select: {
            id: true,
            fullName: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    return applications.map((application) => ({
      participantId: application.participant.id,
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
