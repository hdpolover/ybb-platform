/**
 * Admin Update Submission Command
 *
 * Application Layer - Command
 * Carries the intent for an admin to edit a locked (post-submit) application's
 * submission data. Bypasses the draft-only edit guard intentionally.
 */
export class AdminUpdateSubmissionCommand {
  constructor(
    /** ID of the ParticipantApplication to edit. */
    public readonly applicationId: string,

    /** User.id of the authenticated admin performing the edit. */
    public readonly adminUserId: string,

    /** Human-readable reason for the edit — stored in ApplicationEditHistory. */
    public readonly reason: string,

    /** Partial merge into personalData JSON. */
    public readonly personalData?: Record<string, unknown>,

    /** Partial merge into essayAnswers JSON. */
    public readonly essayAnswers?: Record<string, unknown>,

    /** Patch for Participant columns (fullName, nickName, displayName). */
    public readonly participant?: {
      fullName?: string;
      nickName?: string;
      displayName?: string;
    },

    /** Patch for ParticipantApplication text columns. */
    public readonly application?: {
      motivationLetter?: string;
      achievements?: string;
      experiences?: string;
      twibbonLink?: string;
    },
  ) {}
}
