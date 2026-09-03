import { ApplicationCategory } from '@core/entities/participant-application.entity';

export class SwitchApplicationCategoryCommand {
  constructor(
    public readonly applicationId: string,
    public readonly targetCategory: ApplicationCategory,
    public readonly userId: string,
    /**
     * admins.id when an ADMIN is acting on someone else's application (the
     * reviewer queue's "wrong category" fix), undefined when a participant is
     * switching their own. Presence of this is what lifts the ownership check.
     */
    public readonly actingAdminId?: string,
    /**
     * Required to switch an application whose registration fee is already
     * paid or processing. Participants can never do that; an admin can, with
     * a stated reason that the audit trail records.
     */
    public readonly overrideReason?: string,
  ) {}
}
