import { ApplicationStatus, ApplicationCategory, ScoreStatus, DocumentFile, ApplicationStatusHistoryEntry } from '@core/entities/participant-application.entity';

export class ApplicationStepDto {
  section: string;       // e.g., 'personal_info'
  label: string;         // e.g., 'Personal Details'
  status: 'completed' | 'in_progress' | 'not_started';
  flag: string;          // UI Label: 'Process', 'Not yet', 'Done'
  progress: number;      // 0 to 100
}

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
  documents?: Record<string, DocumentFile>;
  requirementFiles?: DocumentFile[];
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
  participantSnapshot?: Record<string, unknown>;
  statusHistory?: ApplicationStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  lastEditedAt?: Date;
  withdrawnAt?: Date;
  withdrawnBy?: string;

  // Progress Steps for UI
  steps?: ApplicationStepDto[];

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
