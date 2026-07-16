import { ApplicationStatus, ApplicationCategory, ScoreStatus, DocumentFile, ApplicationStatusHistoryEntry } from '@core/entities/participant-application.entity';

export class ApplicationStepDto {
  section: string;       // e.g., 'personal_info'
  label: string;         // e.g., 'Personal Details'
  status: 'completed' | 'in_progress' | 'not_started';
  flag: string;          // UI Label: 'Process', 'Not yet', 'Done'
  progress: number;      // 0 to 100
}

/**
 * A single editable field descriptor returned to the admin for the
 * Edit-Submission feature.  File-type fields are included but flagged
 * readonly so the UI can render them as read-only displays.
 */
export class SubmissionFormFieldAdminDto {
  /** Field machine name (key in personalData or essayAnswers). */
  name: string;
  /** Human-readable label from the form definition. */
  label: string;
  /** Raw field type as configured in the program form (e.g. 'text', 'textarea', 'select', 'date', 'file'). */
  type: string;
  /** Which JSON blob this field's value should be written to when patching. */
  store: 'personalData' | 'essayAnswers';
  /** Section identifier the field belongs to (e.g. 'personal_info', 'essay'). */
  section: string;
  /** Whether the field was marked required in the form definition. */
  isRequired: boolean;
  /** Current persisted value (string representation; empty string if absent). */
  value: string;
  /** File and upload fields should not be edited through this tool. */
  readonly: boolean;
  /** Configured selectable options, if any. */
  options?: Array<{ label: string; value: string }>;
  /** Display order within the section. */
  order: number;
}

export class SubmissionSectionAdminDto {
  /** Section machine name (e.g. 'personal_info', 'essay'). */
  section: string;
  /** Human-readable section label. */
  label: string;
  /** Ordered list of field descriptors for this section. */
  fields: SubmissionFormFieldAdminDto[];
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
  sourceAccountName?: string | null;
  requirementLink?: string | null;
  referralCode?: string | null;
  subthemeId?: string | null;
  subthemeName?: string | null;
  essays?: Array<{ id: string; question: string; answer: string | null; wordLimit: number | null; order: number; isRequired: boolean }>;
  documents?: Record<string, DocumentFile>;
  requirementFiles?: DocumentFile[];
  twibbonLink?: string;
  pricingTierId?: string;
  paymentAmount?: number;
  paymentId?: string;
  paymentStatus?: string;
  registrationPaymentStatus?: string;
  programPaymentStatus?: string;
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

  /**
   * Structured submission form for the admin Edit-Submission feature.
   * Only present when the program has form field definitions.
   * Fields are grouped by section and include current persisted values.
   * File-type fields are included with `readonly: true` so the UI can display
   * them without offering an edit control.
   */
  submissionForm?: {
    sections: SubmissionSectionAdminDto[];
  };

  // Relations (populated when requested)
  participant?: {
    id: string;
    fullName: string;
    nickName?: string | null;
    email: string;
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
    birthdate?: Date | null;
    gender?: string | null;
    nationality?: string | null;
    originCity?: string | null;
    originCountry?: string | null;
    originAddress?: string | null;
    currentCity?: string | null;
    currentCountry?: string | null;
    currentAddress?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactCountryCode?: string | null;
    emergencyContactRelation?: string | null;
    tshirtSize?: string | null;
    medicalConditions?: string | null;
    educationLevel?: string | null;
    institution?: string | null;
    major?: string | null;
    organizations?: string | null;
    instagramUsername?: string | null;
    linkedinUrl?: string | null;
    portfolioUrl?: string | null;
    knowledgeSource?: string | null;
    referralCode?: string | null;
    profilePictureUrl?: string | null;
    resumeUrl?: string | null;
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
