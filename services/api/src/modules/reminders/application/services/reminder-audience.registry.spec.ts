// src/modules/reminders/application/services/reminder-audience.registry.spec.ts
import { ReminderAudienceRegistry } from './reminder-audience.registry';
import { RegistrationFeeAudienceService } from './registration-fee-audience.service';
import { ApplicationDraftUnsubmittedAudienceService } from './application-draft-unsubmitted-audience.service';
import { ProgramFeeUnpaidAudienceService } from './program-fee-unpaid-audience.service';

describe('ReminderAudienceRegistry', () => {
  function build() {
    const registrationFeePreview = jest.fn().mockResolvedValue({
      registrationFeeConfigured: false,
      count: 0,
      members: [],
      listLimit: 200,
    });
    const registrationFeeFindRecipients = jest.fn().mockResolvedValue(['reg-fee-recipient']);
    const draftUnsubmittedFindRecipients = jest.fn().mockResolvedValue(['draft-recipient']);
    const programFeeFindRecipients = jest.fn().mockResolvedValue(['program-fee-recipient']);

    const registry = new ReminderAudienceRegistry(
      {
        preview: registrationFeePreview,
        findRecipients: registrationFeeFindRecipients,
      } as unknown as RegistrationFeeAudienceService,
      {
        preview: jest.fn(),
        findRecipients: draftUnsubmittedFindRecipients,
      } as unknown as ApplicationDraftUnsubmittedAudienceService,
      {
        preview: jest.fn(),
        findRecipients: programFeeFindRecipients,
      } as unknown as ProgramFeeUnpaidAudienceService,
    );

    return {
      registry,
      registrationFeePreview,
      registrationFeeFindRecipients,
      draftUnsubmittedFindRecipients,
      programFeeFindRecipients,
    };
  }

  it('dispatches each audience string to its own service — the map, not an if-chain', async () => {
    const {
      registry,
      registrationFeeFindRecipients,
      draftUnsubmittedFindRecipients,
      programFeeFindRecipients,
    } = build();

    await expect(
      registry.resolve('registration_fee_unpaid').findRecipients('prog-1'),
    ).resolves.toEqual(['reg-fee-recipient']);
    await expect(
      registry.resolve('application_draft_unsubmitted').findRecipients('prog-1'),
    ).resolves.toEqual(['draft-recipient']);
    await expect(
      registry.resolve('program_fee_unpaid').findRecipients('prog-1'),
    ).resolves.toEqual(['program-fee-recipient']);

    expect(registrationFeeFindRecipients).toHaveBeenCalledWith('prog-1');
    expect(draftUnsubmittedFindRecipients).toHaveBeenCalledWith('prog-1');
    expect(programFeeFindRecipients).toHaveBeenCalledWith('prog-1');
  });

  it('throws rather than silently returning undefined for an unmapped audience', () => {
    const { registry } = build();

    expect(() => registry.resolve('not_a_real_audience')).toThrow();
  });

  it("adapts RegistrationFeeAudienceService's registrationFeeConfigured field to the generic applicable flag", async () => {
    const { registry, registrationFeePreview } = build();

    const preview = await registry.resolve('registration_fee_unpaid').preview('prog-1');

    expect(registrationFeePreview).toHaveBeenCalledWith('prog-1', undefined);
    expect(preview).toEqual({ applicable: false, count: 0, members: [], listLimit: 200 });
  });
});
