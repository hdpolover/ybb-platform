import { ApplicationStatus, ApplicationCategory, ScoreStatus } from '@core/entities/participant-application.entity';

/**
 * Application Response DTO
 * 
 * Application Layer - Response Data Transfer Object
 */
export class ApplicationResponseDto {
  id: string;
  participantId: string;
  programId: string;
  status: ApplicationStatus;
  applicationCategory?: ApplicationCategory;
  motivationLetter?: string;
  achievements?: string;
  experiences?: string;
  documents?: Record<string, any>;
  requirementFiles?: any[];
  twibbonLink?: string;
  pricingTierId?: string;
  paymentAmount?: number;
  paymentId?: string;
  paymentStatus?: string;
  scoreTotal?: number;
  scoreBreakdown?: Record<string, number>;
  scoreStatus?: ScoreStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewerNotes?: string;
  participantSnapshot?: Record<string, any>;
  statusHistory?: any[];
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  lastEditedAt?: Date;
  withdrawnAt?: Date;
  withdrawnBy?: string;

  // Relations (populated when requested)
  participant?: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber?: string;
  };
  program?: {
    id: string;
    name: string;
    year: number;
    startDate: Date;
    endDate: Date;
  };
  reviewer?: {
    id: string;
    fullName: string;
  };
}

export class ApplicationListResponseDto {
  applications: ApplicationResponseDto[];
  total: number;
  page?: number;
  limit?: number;
}
