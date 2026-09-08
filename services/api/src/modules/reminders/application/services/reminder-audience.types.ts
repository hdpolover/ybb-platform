// src/modules/reminders/application/services/reminder-audience.types.ts
import { ParticipantReminderRecipient } from '../../../../common/types/events';

/** One row in an audience preview list, shared across every audience type. */
export interface ReminderAudienceMemberBase {
  applicationId: string;
  participantId: string;
  participantName: string;
  email: string;
  applicationStatus: string;
  registrationPaymentStatus: string;
  submittedAt: Date | null;
  registeredAt: Date;
}

export interface ReminderAudiencePreviewResult {
  /**
   * False only when the audience is gated on program configuration that is
   * not currently in place (registration_fee_unpaid with no active
   * registration_fee tier is the one example today) — the audience is empty
   * because nothing is owed, not because everyone already qualifies. Every
   * audience with no such gate is always applicable.
   */
  applicable: boolean;
  /** True total; `members` is capped at `listLimit`. */
  count: number;
  members: ReminderAudienceMemberBase[];
  listLimit: number;
}

/**
 * Uniform surface every reminder audience service exposes, resolved by
 * ReminderAudienceRegistry from the reminder's `audience` column. Adding a
 * new audience is: implement this, add one entry to the registry, one to
 * REMINDER_AUDIENCES, and one to the migration's CHECK constraint.
 */
export interface ReminderAudienceAdapter {
  preview(programId: string, listLimit?: number): Promise<ReminderAudiencePreviewResult>;
  /**
   * The audience as mail recipients, snapshotted at dispatch time. Unbounded
   * on purpose — a preview may be capped, but a send must not silently skip
   * anyone past an arbitrary limit.
   */
  findRecipients(programId: string): Promise<ParticipantReminderRecipient[]>;
}
