// src/modules/reminders/application/services/program-fee-unpaid-audience.service.ts
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
 * "Submitted the application, but the programme fee is not paid."
 *
 * Clones RegistrationFeeAudienceService's shape and exclusions exactly — same
 * active-participant gate, same withdrawn/rejected exclusion, same
 * dedupe-by-participant on the recipient path — only the payment/submission
 * predicate differs. See that file for the long-form rationale behind each
 * exclusion; it is not repeated here.
 *
 * No program-level gate here either: "submitted, programme fee unpaid" is a
 * fact about the application regardless of the program's current pricing-tier
 * configuration, so `applicable` is always true.
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
export class ProgramFeeUnpaidAudienceService implements ReminderAudienceAdapter {
  constructor(private readonly prisma: PrismaService) {}

  buildWhere(programId: string): Prisma.ParticipantApplicationWhereInput {
    return {
      programId,
      deletedAt: null,
      status: { notIn: [...EXCLUDED_APPLICATION_STATUSES] },
      participant: ACTIVE_PARTICIPANT_WHERE,
      // The predicate this audience exists for: submitted, programme fee not paid.
      submittedAt: { not: null },
      programPaymentStatus: { not: PaymentStatus.paid },
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
