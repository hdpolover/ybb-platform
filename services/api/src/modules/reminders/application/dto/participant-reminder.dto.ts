// src/modules/reminders/application/dto/participant-reminder.dto.ts
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { REMINDER_AUDIENCE_VALUES, REMINDER_AUDIENCES } from '../../reminder.constants';

/**
 * A scheduled send time must carry an EXPLICIT UTC offset (…+07:00 or …Z).
 *
 * The team is in Jakarta and thinks in WIB (Asia/Jakarta, UTC+7, no DST). A
 * bare "2026-09-09T08:00:00" would be parsed against whatever TZ the API
 * container happens to run in, which is exactly the class of mistake that put
 * a tier date on the wrong side of a day boundary. Requiring the offset means
 * the instant an admin picked is the instant that gets stored, with nothing
 * left to infer. The admin dashboard always appends +07:00.
 */
const ISO_DATETIME_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const OFFSET_REQUIRED_MESSAGE =
  'scheduledAt must be an ISO-8601 datetime with an explicit UTC offset, e.g. 2026-09-09T08:00:00+07:00 (WIB)';

export class CreateParticipantReminderDto {
  @IsOptional()
  @IsIn(REMINDER_AUDIENCE_VALUES)
  audience?: string = REMINDER_AUDIENCES.REGISTRATION_FEE_UNPAID;

  @IsString() @MinLength(1) @MaxLength(255) subject: string;

  /** Plain text, not HTML. Tokens: {{participant_name}}, {{program_name}}. */
  @IsString() @MinLength(1) @MaxLength(20000) body: string;

  /** Omit to save as a draft; provide to schedule immediately on create. */
  @IsOptional()
  @Matches(ISO_DATETIME_WITH_OFFSET, { message: OFFSET_REQUIRED_MESSAGE })
  scheduledAt?: string;
}

export class UpdateParticipantReminderDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) subject?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(20000) body?: string;

  /**
   * A datetime schedules (or reschedules) the reminder. `null` returns it to a
   * draft. Omitting the key leaves the current schedule untouched.
   */
  @IsOptional()
  @Matches(ISO_DATETIME_WITH_OFFSET, { message: OFFSET_REQUIRED_MESSAGE })
  scheduledAt?: string | null;
}

// ─── Responses ────────────────────────────────────────────────────────────────

export class ParticipantReminderSendResponseDto {
  participantId: string;
  participantName: string;
  /** The address the email was actually addressed to, as of dispatch time. */
  email: string;
  status: 'pending' | 'sent' | 'failed';
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  sentAt: Date | null;
}

export class ParticipantReminderSendSummaryDto {
  total: number;
  pending: number;
  sent: number;
  failed: number;
}

export class ParticipantReminderResponseDto {
  id: string;
  programId: string;
  audience: string;
  subject: string;
  body: string;
  scheduledAt: Date | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  dispatchedAt: Date | null;
  sentAt: Date | null;
  cancelledAt: Date | null;
  /**
   * Audience size snapshotted at dispatch. Null until then; 0 is a real
   * outcome meaning nobody owed the fee when the send time arrived.
   */
  audienceCount: number | null;
  createdAt: Date;
  summary: ParticipantReminderSendSummaryDto;
}

export class ParticipantReminderDetailResponseDto extends ParticipantReminderResponseDto {
  /**
   * False before dispatch, and for any reminder that fanned out to nobody.
   * The UI must not render a bare "0 sent" for a reminder that never ran.
   */
  hasSendLog: boolean;
  recipients: ParticipantReminderSendResponseDto[];
}

export class ReminderAudienceMemberDto {
  applicationId: string;
  participantId: string;
  participantName: string;
  email: string;
  applicationStatus: string;
  registrationPaymentStatus: string;
  submittedAt: Date | null;
  registeredAt: Date;
}

export class ReminderAudiencePreviewDto {
  audience: string;
  /**
   * False when the program has no active registration_fee pricing tier — the
   * audience is then empty because nothing is owed, which is not the same as
   * everybody having paid.
   */
  registrationFeeConfigured: boolean;
  /** True total; `members` is capped at `listLimit`. */
  count: number;
  listLimit: number;
  members: ReminderAudienceMemberDto[];
  /** The subject/body rendered against the first member, when one was asked for. */
  preview: { subject: string; body: string } | null;
}
