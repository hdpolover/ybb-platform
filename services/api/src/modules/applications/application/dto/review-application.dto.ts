import { ApplicationStatus, ScoreStatus } from '@core/entities/participant-application.entity';

/**
 * Review Application DTO
 * 
 * Application Layer - Data Transfer Object
 */
export class ReviewApplicationDto {
  status: ApplicationStatus;
  reviewerNotes?: string;
  scoreTotal?: number;
  scoreBreakdown?: Record<string, number>;
  scoreStatus?: ScoreStatus;
}
