// src/modules/reminders/application/services/application-draft-unsubmitted-audience.service.ts
import { Injectable } from '@nestjs/common';
import { ApplicationStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';
import { ParticipantReminderRecipient } from '../../../../common/types/events';
import { REMINDER_AUDIENCE_PREVIEW_LIMIT } from '../../reminder.constants';
import {
  ReminderAudienceAdapter,
  ReminderAudienceMemberBase,
  ReminderAudiencePreviewResult,
} from './reminder-audience.types';

/**
 * "Paid the registration fee, but the application was never submitted."
 *
 * This clones RegistrationFeeAudienceService's shape and exclusions exactly
 * — same active-participant gate, same withdrawn/rejected exclusion, same
 * dedupe-by-participant on the recipient path — only the payment/submission
 * predicate differs. See that file for the long-form rationale behind each
 * exclusion; it is not repeated here.
 *
 * Unlike registration_fee_unpaid, this audience has no program-level gate:
 * "paid the registration fee" is a fact about the application regardless of
 * whether the program's registration_fee tier is still active today, so
 * `applicable` is always true.
 *
 * ── Overlap with the automated nudge ─────────────────────────────────────
 * This is the SAME population PostPaymentFollowupService already emails
 * automatically, three days after the registration-fee payment lands (see
 * src/modules/applications/infrastructure/services/post-payment-followup.service.ts).
 * That cron additionally requires the payment to postdate
 * POST_PAYMENT_FOLLOWUP_CUTOFF and claims each application via
 * postPaymentFollowupSentAt so it never repeats — this audience reproduces
 * neither rule, since a manual reminder is a deliberate one-off an admin
 * chooses to send, not a rule to keep in sync with the cron. See
 * REMINDER_AUDIENCE_OVERLAP_NOTES, surfaced to the admin UI as a
 * non-blocking heads-up.
 */

const EXCLUDED_APPLICATION_STATUSES = [
  ApplicationStatus.withdrawn,
  ApplicationStatus.rejected,
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

@Injectable()
export class ApplicationDraftUnsubmittedAudienceService implements ReminderAudienceAdapter {
  constructor(private readonly prisma: PrismaService) {}

  buildWhere(programId: string): Prisma.ParticipantApplicationWhereInput {
    return {
      programId,
      deletedAt: null,
      status: { notIn: [...EXCLUDED_APPLICATION_STATUSES] },
      participant: ACTIVE_PARTICIPANT_WHERE,
      // The predicate this audience exists for: paid, never submitted.
      registrationPaymentStatus: PaymentStatus.paid,
      submittedAt: null,
    };
  }

  async preview(
    programId: string,
    listLimit: number = REMINDER_AUDIENCE_PREVIEW_LIMIT,
  ): Promise<ReminderAudiencePreviewResult> {
    const where = this.buildWhere(programId);
    const [count, rows] = await Promise.all([
      this.prisma.participantApplication.count({ where }),
      this.prisma.participantApplication.findMany({
        where,
        select: AUDIENCE_ROW_SELECT,
        // Longest-outstanding first, same as every other audience preview.
        orderBy: { createdAt: 'asc' },
        take: listLimit,
      }),
    ]);

    return { applicable: true, count, members: rows.map(toAudienceMember), listLimit };
  }

  async findRecipients(programId: string): Promise<ParticipantReminderRecipient[]> {
    const rows = await this.prisma.participantApplication.findMany({
      where: this.buildWhere(programId),
      select: AUDIENCE_ROW_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    // One participant can hold at most one application per program in
    // practice, but the send log's unique key is (reminder, participant) —
    // dedupe here rather than letting a duplicate pair vanish on insert.
    const byParticipantId = new Map<string, ParticipantReminderRecipient>();
    for (const row of rows) {
      if (byParticipantId.has(row.participant.id)) continue;
      byParticipantId.set(row.participant.id, {
        participantId: row.participant.id,
        userId: row.participant.user.id,
        email: row.participant.user.email,
        fullName: row.participant.fullName || 'Participant',
      });
    }
    return [...byParticipantId.values()];
  }
}

function toAudienceMember(row: AudienceRow): ReminderAudienceMemberBase {
  return {
    applicationId: row.id,
    participantId: row.participant.id,
    participantName: row.participant.fullName || row.participant.user.email,
    email: row.participant.user.email,
    applicationStatus: row.status,
    registrationPaymentStatus: row.registrationPaymentStatus,
    submittedAt: row.submittedAt,
    registeredAt: row.createdAt,
  };
}
