// src/modules/reminders/application/services/participant-reminder.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { renderReminderTokens } from '@shared/utils/reminder-message-tokens.util';
import { ParticipantReminderRepository } from '../../infrastructure/persistence/participant-reminder.repository';
import { ParticipantReminderSendRepository } from '../../infrastructure/persistence/participant-reminder-send.repository';
import { RegistrationFeeAudienceService } from './registration-fee-audience.service';
import {
  REMINDER_AUDIENCES,
  REMINDER_EDITABLE_STATUSES,
  REMINDER_STATUS,
  ReminderStatus,
} from '../../reminder.constants';
import {
  CreateParticipantReminderDto,
  ParticipantReminderDetailResponseDto,
  ParticipantReminderResponseDto,
  ParticipantReminderSendResponseDto,
  ParticipantReminderSendSummaryDto,
  ReminderAudiencePreviewDto,
  UpdateParticipantReminderDto,
} from '../dto/participant-reminder.dto';

type ReminderRow = {
  id: string;
  programId: string;
  audience: string;
  subject: string;
  body: string;
  scheduledAt: Date | null;
  status: string;
  dispatchedAt: Date | null;
  sentAt: Date | null;
  cancelledAt: Date | null;
  audienceCount: number | null;
  createdAt: Date;
};

const EMPTY_SUMMARY: ParticipantReminderSendSummaryDto = {
  total: 0,
  pending: 0,
  sent: 0,
  failed: 0,
};

/**
 * Admin-facing CRUD for participant reminders. Nothing here sends anything —
 * the only send path is ParticipantReminderDispatchService's cron, reached
 * exclusively by a reminder an admin explicitly moved to `scheduled`.
 */
@Injectable()
export class ParticipantReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderRepo: ParticipantReminderRepository,
    private readonly sendRepo: ParticipantReminderSendRepository,
    private readonly audienceService: RegistrationFeeAudienceService,
  ) {}

  async previewAudience(programId: string): Promise<ReminderAudiencePreviewDto> {
    await this.assertProgramExists(programId);
    const audience = await this.audienceService.preview(programId);

    return {
      audience: REMINDER_AUDIENCES.REGISTRATION_FEE_UNPAID,
      registrationFeeConfigured: audience.registrationFeeConfigured,
      count: audience.count,
      listLimit: audience.listLimit,
      members: audience.members,
      preview: null,
    };
  }

  /**
   * Same audience, plus the draft rendered against the first real member, so an
   * admin sees the exact text a participant will read — token substitution
   * included — before committing to a send time. Falls back to a clearly
   * labelled sample name when the audience is empty.
   */
  async previewMessage(
    programId: string,
    subject: string,
    body: string,
  ): Promise<ReminderAudiencePreviewDto> {
    const audience = await this.previewAudience(programId);
    const program = await this.assertProgramExists(programId);
    const participantName = audience.members[0]?.participantName ?? 'Participant';
    const values = { participantName, programName: program.name };

    return {
      ...audience,
      preview: {
        subject: renderReminderTokens(subject, values),
        body: renderReminderTokens(body, values),
      },
    };
  }

  async list(programId: string): Promise<ParticipantReminderResponseDto[]> {
    await this.assertProgramExists(programId);
    const reminders = await this.reminderRepo.findByProgram(programId);
    const summaries = await this.summariesFor(reminders.map((reminder) => reminder.id));

    return reminders.map((reminder) =>
      toResponse(reminder, summaries.get(reminder.id) ?? EMPTY_SUMMARY),
    );
  }

  async get(
    programId: string,
    reminderId: string,
  ): Promise<ParticipantReminderDetailResponseDto> {
    const reminder = await this.assertReminderInProgram(programId, reminderId);
    const sends = await this.sendRepo.findByReminder(reminderId);
    const recipients = await this.attachParticipantNames(sends);

    const summary = sends.reduce<ParticipantReminderSendSummaryDto>(
      (counts, send) => ({
        ...counts,
        total: counts.total + 1,
        [send.status]: (counts[send.status as keyof ParticipantReminderSendSummaryDto] ?? 0) + 1,
      }),
      { ...EMPTY_SUMMARY },
    );

    return {
      ...toResponse(reminder, summary),
      // A reminder that has not dispatched has no log yet; one that dispatched
      // to an empty audience has none either, and audienceCount === 0 is what
      // distinguishes those two in the UI.
      hasSendLog: sends.length > 0,
      recipients,
    };
  }

  async create(
    programId: string,
    dto: CreateParticipantReminderDto,
    adminUserId: string,
  ): Promise<ParticipantReminderResponseDto> {
    await this.assertProgramExists(programId);
    const scheduledAt = this.resolveScheduledAt(dto.scheduledAt);

    const reminder = await this.reminderRepo.create({
      programId,
      audience: dto.audience ?? REMINDER_AUDIENCES.REGISTRATION_FEE_UNPAID,
      subject: dto.subject,
      body: dto.body,
      scheduledAt,
      status: scheduledAt ? REMINDER_STATUS.SCHEDULED : REMINDER_STATUS.DRAFT,
      createdBy: adminUserId,
    });

    return toResponse(reminder, EMPTY_SUMMARY);
  }

  async update(
    programId: string,
    reminderId: string,
    dto: UpdateParticipantReminderDto,
  ): Promise<ParticipantReminderResponseDto> {
    const existing = await this.assertReminderInProgram(programId, reminderId);
    this.assertEditable(existing);

    // `scheduledAt` absent => leave the schedule alone. `null` => back to
    // draft. A datetime => (re)schedule. Status is derived from the resulting
    // send time so the two can never disagree.
    const rescheduling = dto.scheduledAt !== undefined;
    const scheduledAt = rescheduling
      ? this.resolveScheduledAt(dto.scheduledAt)
      : existing.scheduledAt;

    const updated = await this.reminderRepo.updateIfEditable(reminderId, {
      ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
      ...(dto.body !== undefined ? { body: dto.body } : {}),
      ...(rescheduling ? { scheduledAt } : {}),
      ...(rescheduling
        ? {
            status: scheduledAt ? REMINDER_STATUS.SCHEDULED : REMINDER_STATUS.DRAFT,
          }
        : {}),
    });

    if (!updated) {
      // The dispatcher claimed it between the read above and this write.
      throw new ConflictException(
        'This reminder is already sending and can no longer be edited.',
      );
    }

    const summaries = await this.summariesFor([reminderId]);
    return toResponse(updated, summaries.get(reminderId) ?? EMPTY_SUMMARY);
  }

  async cancel(
    programId: string,
    reminderId: string,
  ): Promise<ParticipantReminderResponseDto> {
    await this.assertReminderInProgram(programId, reminderId);
    const cancelled = await this.reminderRepo.cancelIfNotSending(reminderId);

    if (!cancelled) {
      throw new ConflictException(
        'This reminder has already started sending and can no longer be cancelled.',
      );
    }

    const summaries = await this.summariesFor([reminderId]);
    return toResponse(cancelled, summaries.get(reminderId) ?? EMPTY_SUMMARY);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private assertEditable(reminder: ReminderRow): void {
    if (!REMINDER_EDITABLE_STATUSES.includes(reminder.status as ReminderStatus)) {
      throw new ConflictException(
        `A reminder with status "${reminder.status}" can no longer be edited.`,
      );
    }
  }

  /**
   * The DTO already guarantees an explicit UTC offset, so this is a real
   * instant. Scheduling into the past would be picked up by the very next
   * dispatcher tick and mail everyone immediately — almost never what an admin
   * meant, and the one input mistake with no undo, so it is rejected.
   */
  private resolveScheduledAt(value: string | null | undefined): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const scheduledAt = new Date(value);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt is not a valid datetime');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'scheduledAt must be in the future — a past send time would dispatch on the next tick.',
      );
    }
    return scheduledAt;
  }

  private async assertProgramExists(programId: string): Promise<{ name: string }> {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, deletedAt: null },
      select: { name: true },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }
    return program;
  }

  private async assertReminderInProgram(
    programId: string,
    reminderId: string,
  ): Promise<ReminderRow> {
    const reminder = await this.reminderRepo.findById(reminderId);
    if (!reminder || reminder.programId !== programId) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }

  private async summariesFor(
    reminderIds: string[],
  ): Promise<Map<string, ParticipantReminderSendSummaryDto>> {
    const grouped = await this.sendRepo.summariseByReminderIds(reminderIds);

    return grouped.reduce((byReminderId, row) => {
      const current = byReminderId.get(row.reminderId) ?? { ...EMPTY_SUMMARY };
      const count = row._count._all;
      byReminderId.set(row.reminderId, {
        ...current,
        total: current.total + count,
        [row.status]:
          (current[row.status as keyof ParticipantReminderSendSummaryDto] ?? 0) + count,
      });
      return byReminderId;
    }, new Map<string, ParticipantReminderSendSummaryDto>());
  }

  /**
   * The send log deliberately stores no name (it snapshots the email address
   * because that is what delivery used). Resolved here in one extra query
   * rather than via a Prisma relation, so the new table needs no foreign key to
   * participants. Same treatment as the LOA recipient-send read path.
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
  ): Promise<ParticipantReminderSendResponseDto[]> {
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
      status: send.status as ParticipantReminderSendResponseDto['status'],
      providerMessageId: send.providerMessageId,
      errorMessage: send.errorMessage,
      attemptCount: send.attemptCount,
      sentAt: send.sentAt,
    }));
  }
}

function toResponse(
  reminder: ReminderRow,
  summary: ParticipantReminderSendSummaryDto,
): ParticipantReminderResponseDto {
  return {
    id: reminder.id,
    programId: reminder.programId,
    audience: reminder.audience,
    subject: reminder.subject,
    body: reminder.body,
    scheduledAt: reminder.scheduledAt,
    status: reminder.status as ParticipantReminderResponseDto['status'],
    dispatchedAt: reminder.dispatchedAt,
    sentAt: reminder.sentAt,
    cancelledAt: reminder.cancelledAt,
    audienceCount: reminder.audienceCount,
    createdAt: reminder.createdAt,
    summary,
  };
}
