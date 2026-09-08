// src/modules/reminders/application/services/reminder-audience.registry.ts
import { Injectable } from '@nestjs/common';
import { RegistrationFeeAudienceService } from './registration-fee-audience.service';
import { ApplicationDraftUnsubmittedAudienceService } from './application-draft-unsubmitted-audience.service';
import { ProgramFeeUnpaidAudienceService } from './program-fee-unpaid-audience.service';
import { REMINDER_AUDIENCES } from '../../reminder.constants';
import { ReminderAudienceAdapter, ReminderAudiencePreviewResult } from './reminder-audience.types';

/**
 * Adapts RegistrationFeeAudienceService's `registrationFeeConfigured` field
 * to the generic `applicable` flag every other audience uses natively,
 * without touching that service's own public shape — its existing spec
 * asserts an exact object on `preview()`.
 */
function adaptRegistrationFeeService(
  service: RegistrationFeeAudienceService,
): ReminderAudienceAdapter {
  return {
    async preview(programId: string, listLimit?: number): Promise<ReminderAudiencePreviewResult> {
      const result = await service.preview(programId, listLimit);
      return {
        applicable: result.registrationFeeConfigured,
        count: result.count,
        members: result.members,
        listLimit: result.listLimit,
      };
    },
    findRecipients: (programId: string) => service.findRecipients(programId),
  };
}

/**
 * Maps a reminder's `audience` column to the service that knows how to
 * compute it. This is the one place the "which audience" if-chain would
 * otherwise live — adding audience #4 is: implement ReminderAudienceAdapter,
 * inject it here, add one entry to REMINDER_AUDIENCES, and one to the
 * migration's CHECK constraint.
 */
@Injectable()
export class ReminderAudienceRegistry {
  private readonly adapters: ReadonlyMap<string, ReminderAudienceAdapter>;

  constructor(
    registrationFeeAudience: RegistrationFeeAudienceService,
    applicationDraftUnsubmittedAudience: ApplicationDraftUnsubmittedAudienceService,
    programFeeUnpaidAudience: ProgramFeeUnpaidAudienceService,
  ) {
    this.adapters = new Map<string, ReminderAudienceAdapter>([
      [REMINDER_AUDIENCES.REGISTRATION_FEE_UNPAID, adaptRegistrationFeeService(registrationFeeAudience)],
      [REMINDER_AUDIENCES.APPLICATION_DRAFT_UNSUBMITTED, applicationDraftUnsubmittedAudience],
      [REMINDER_AUDIENCES.PROGRAM_FEE_UNPAID, programFeeUnpaidAudience],
    ]);
  }

  /**
   * Throws on an unknown audience rather than returning null: every caller
   * validates the audience string against REMINDER_AUDIENCE_VALUES first
   * (DTO validation on write paths, an explicit check in
   * ParticipantReminderService on the read path), so reaching here with an
   * unmapped value is a programming error, not user input.
   */
  resolve(audience: string): ReminderAudienceAdapter {
    const adapter = this.adapters.get(audience);
    if (!adapter) {
      throw new Error(`No ReminderAudienceAdapter registered for audience "${audience}"`);
    }
    return adapter;
  }
}
