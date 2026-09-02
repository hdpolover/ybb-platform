// src/modules/reminders/application/services/registration-fee-audience.service.ts
import { Injectable } from '@nestjs/common';
import { ApplicationStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';
import { ParticipantReminderRecipient } from '../../../../common/types/events';
import { REMINDER_AUDIENCE_PREVIEW_LIMIT } from '../../reminder.constants';

/**
 * "Registered, but has not paid the registration fee."
 *
 * ── Why this cannot be "has no invoice row" ──────────────────────────────────
 * ApplicationInvoice rows are minted LAZILY — only when the participant opens
 * the Payments page and clicks a fee (see EnsurePortalPaymentInvoiceHandler,
 * and the long comment on calculate-portal-total-required.ts explaining the
 * $0.00 "Total Required" bug this caused). A freshly-registered participant who
 * owes the registration fee therefore has NO invoice at all. Absence of an
 * invoice is the single most common UNPAID state, not evidence of payment.
 *
 * ── What "unpaid" actually means ─────────────────────────────────────────────
 * This mirrors RegistrationFeeGateService — the one authoritative check that
 * decides whether a participant may submit — rather than inventing a second
 * definition that could drift from it:
 *
 *  1. Program level, fail-closed: the fee is owed only if the program has an
 *     ACTIVE `registration_fee` pricing tier. No tier means the program charges
 *     no registration fee and the audience is empty (assertRegistrationFeePaid
 *     step 1). Note the fee is owed by fully_funded and self_funded alike —
 *     YBB runs a reimbursement model, pay first and reimburse later — so there
 *     is deliberately no category carve-out here.
 *  2. Application level, paid if EITHER:
 *       (a) registrationPaymentStatus === 'paid'  [canonical fast path], or
 *       (b) a `paid` ApplicationInvoice on a registration_fee tier exists
 *           [the denormalised column can lag the invoice; step 3 of the gate].
 *
 * ── One deliberate widening of the gate ─────────────────────────────────────
 * A registration-fee invoice sitting in `processing` also drops out of this
 * audience even though the gate would still block that participant. Processing
 * means they have paid and are waiting on gateway settlement or on an admin
 * verifying a manual transfer — and payment.succeeded events are known to drop,
 * leaving genuinely-paid invoices stuck in `processing`. Emailing "you have not
 * paid" to someone whose proof of transfer is sitting in the admin queue is a
 * support incident, not a nudge. This matches SETTLED_OR_INFLIGHT_STATUSES in
 * calculate-portal-total-required.ts, which is what the participant's own
 * dashboard already tells them they owe.
 *
 * ── Who is excluded ─────────────────────────────────────────────────────────
 * Deactivated/soft-deleted accounts (ACTIVE_PARTICIPANT_WHERE — the shared
 * predicate for exports and automated emails), soft-deleted applications, and
 * withdrawn/rejected applications, who are out of the funnel and must not be
 * chased for money.
 */

const EXCLUDED_APPLICATION_STATUSES = [
  ApplicationStatus.withdrawn,
  ApplicationStatus.rejected,
] as const;

// A registration-fee invoice in one of these states means nothing (more) is
// owed right now. See the "one deliberate widening" note above.
const SETTLED_OR_INFLIGHT_INVOICE_STATUSES = [
  PaymentStatus.paid,
  PaymentStatus.processing,
] as const;

const AUDIENCE_ROW_SELECT = {
  id: true,
  status: true,
  registrationPaymentStatus: true,
  submittedAt: true,
  createdAt: true,
  participant: {
    select: {
      id: true,
      fullName: true,
      user: { select: { id: true, email: true } },
    },
  },
} satisfies Prisma.ParticipantApplicationSelect;

type AudienceRow = Prisma.ParticipantApplicationGetPayload<{
  select: typeof AUDIENCE_ROW_SELECT;
}>;

export interface RegistrationFeeAudienceMember {
  applicationId: string;
  participantId: string;
  participantName: string;
  email: string;
  /** Application lifecycle state — 'draft' means not submitted yet. */
  applicationStatus: string;
  /** The denormalised registration payment column, for admin sanity-checking. */
  registrationPaymentStatus: string;
  submittedAt: Date | null;
  registeredAt: Date;
}

export interface RegistrationFeeAudiencePreview {
  /**
   * False when the program has no active registration_fee tier. The audience
   * is then empty because nothing is owed — which is a very different thing
   * from "everyone has paid", and the UI says so.
   */
  registrationFeeConfigured: boolean;
  /** True total. `members` below is capped. */
  count: number;
  members: RegistrationFeeAudienceMember[];
  /** How many members the list was capped to. */
  listLimit: number;
}

@Injectable()
export class RegistrationFeeAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fail-closed program gate, identical to RegistrationFeeGateService step 1.
   * Deliberately ignores the tier's allowedCategories: the gate that actually
   * blocks submission ignores them too, so a fully_funded participant facing a
   * self_funded-only tier really is blocked, and really should be reminded.
   */
  async hasActiveRegistrationFee(programId: string): Promise<boolean> {
    const tier = await this.prisma.programPricingTier.findFirst({
      where: {
        programId,
        isActive: true,
        deletedAt: null,
        feeType: 'registration_fee',
      },
      select: { id: true },
    });
    return tier !== null;
  }

  buildWhere(programId: string): Prisma.ParticipantApplicationWhereInput {
    return {
      programId,
      deletedAt: null,
      status: { notIn: [...EXCLUDED_APPLICATION_STATUSES] },
      participant: ACTIVE_PARTICIPANT_WHERE,
      // (a) canonical fast path
      registrationPaymentStatus: { not: PaymentStatus.paid },
      // (b) no settled/in-flight registration-fee invoice. `none` is correct
      // even when the participant has no invoice rows at all — which, with
      // lazy minting, is the usual case.
      invoices: {
        none: {
          status: { in: [...SETTLED_OR_INFLIGHT_INVOICE_STATUSES] },
          pricingTier: { feeType: 'registration_fee' },
        },
      },
    };
  }

  async preview(
    programId: string,
    listLimit: number = REMINDER_AUDIENCE_PREVIEW_LIMIT,
  ): Promise<RegistrationFeeAudiencePreview> {
    const registrationFeeConfigured = await this.hasActiveRegistrationFee(programId);
    if (!registrationFeeConfigured) {
      return { registrationFeeConfigured: false, count: 0, members: [], listLimit };
    }

    const where = this.buildWhere(programId);
    const [count, rows] = await Promise.all([
      this.prisma.participantApplication.count({ where }),
      this.prisma.participantApplication.findMany({
        where,
        select: AUDIENCE_ROW_SELECT,
        // Longest-outstanding first: those are the ones an admin most wants to
        // eyeball before agreeing to mail the list.
        orderBy: { createdAt: 'asc' },
        take: listLimit,
      }),
    ]);

    return {
      registrationFeeConfigured: true,
      count,
      members: rows.map(toAudienceMember),
      listLimit,
    };
  }

  /**
   * The audience as mail recipients, snapshotted at dispatch time. Unbounded
   * on purpose — a preview may be capped, but a send must not silently skip
   * anyone past an arbitrary limit.
   */
  async findRecipients(programId: string): Promise<ParticipantReminderRecipient[]> {
    if (!(await this.hasActiveRegistrationFee(programId))) {
      return [];
    }

    const rows = await this.prisma.participantApplication.findMany({
      where: this.buildWhere(programId),
      select: AUDIENCE_ROW_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    // One participant can hold at most one application per program in practice,
    // but the send log's unique key is (reminder, participant) — so dedupe here
    // rather than letting a duplicate pair silently vanish on insert and leave
    // the recipient count disagreeing with the row count.
    const byParticipantId = new Map<string, ParticipantReminderRecipient>();
    for (const row of rows) {
      if (byParticipantId.has(row.participant.id)) continue;
      byParticipantId.set(row.participant.id, {
        participantId: row.participant.id,
        userId: row.participant.user.id,
        email: row.participant.user.email,
        // full_name is '' (not null) until onboarding completes; an email
        // addressed to nobody reads worse than a generic salutation.
        fullName: row.participant.fullName || 'Participant',
      });
    }
    return [...byParticipantId.values()];
  }
}

function toAudienceMember(row: AudienceRow): RegistrationFeeAudienceMember {
  return {
    applicationId: row.id,
    participantId: row.participant.id,
    // Blank until onboarding completes — an empty cell reads as a bug, so fall
    // back to the address the mail would actually go to.
    participantName: row.participant.fullName || row.participant.user.email,
    email: row.participant.user.email,
    applicationStatus: row.status,
    registrationPaymentStatus: row.registrationPaymentStatus,
    submittedAt: row.submittedAt,
    registeredAt: row.createdAt,
  };
}
