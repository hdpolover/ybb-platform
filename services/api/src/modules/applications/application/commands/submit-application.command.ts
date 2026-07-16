/**
 * Submit Application Command
 * 
 * Application Layer - Command
 */
export class SubmitApplicationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly participantId: string, // For authorization
  ) {}
}
