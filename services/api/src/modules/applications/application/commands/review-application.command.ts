import { ApplicationStatus } from '@core/entities/participant-application.entity';

/**
 * Review Application Command
 *
 * Application Layer - Command
 */
export class ReviewApplicationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly reviewerId: string,
    public readonly status: ApplicationStatus,
    public readonly reviewerNotes?: string,
    public readonly approvalMode?: 'participant' | 'ambassador',
  ) {}
}
