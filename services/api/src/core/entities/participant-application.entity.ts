/**
 * Participant Application Entity
 * 
 * Domain Layer - Core Business Entity
 * Represents a participant's application to a program
 */

export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WAITLISTED = 'waitlisted',
  WITHDRAWN = 'withdrawn',
}

export enum ApplicationCategory {
  FULLY_FUNDED = 'fully_funded',
  SELF_FUNDED = 'self_funded',
}

export enum ScoreStatus {
  PENDING = 'pending',
  SCORED = 'scored',
  GO_TO_INTERVIEW = 'go_to_interview',
  REJECTED = 'rejected',
}

export interface ApplicationAnswer {
  questionId: string;
  question: string;
  answer: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'file';
}

export interface ApplicationDocument {
  documentId: string;
  documentType: string;
  fileUrl: string;
  uploadedAt: Date;
}

export interface ScoreBreakdown {
  [criterion: string]: number;
}

export interface DocumentFile {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedAt?: string;
}

export interface ApplicationStatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}

export class ParticipantApplication {
  constructor(
    public readonly id: string,
    public readonly participantId: string,
    public readonly programId: string,
    public status: ApplicationStatus,
    public applicationCategory?: ApplicationCategory,
    // New JSON Fields
    public personalData: Record<string, unknown> = {},
    public essayAnswers: Record<string, unknown> = {},
    public uploadedFiles: Record<string, DocumentFile> = {},

    public motivationLetter?: string,
    public achievements?: string,
    public experiences?: string,
    public documents?: Record<string, DocumentFile>,
    public requirementFiles?: DocumentFile[],
    public twibbonLink?: string,
    public pricingTierId?: string,
    public scoreTotal?: number,
    public scoreBreakdown?: ScoreBreakdown,
    public scoreStatus?: ScoreStatus,
    public reviewedBy?: string,
    public reviewedAt?: Date,
    public reviewerNotes?: string,
    public participantSnapshot?: Record<string, unknown>,
    public statusHistory?: ApplicationStatusHistoryEntry[],
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public submittedAt?: Date,
    public readonly lastEditedAt?: Date,
    public readonly withdrawnAt?: Date,
    public readonly withdrawnBy?: string,
  ) {}

  /**
   * Business Rules
   */

  /**
   * Status-only check. Does NOT enforce Program.applicationDeadline - the
   * entity has no visibility into the program's deadline, and callers that
   * need to reject a late submission must check that separately via
   * shared/utils/submission-deadline.util.ts (isPastSubmissionDeadline),
   * using the program's applicationDeadline fetched at the call site. See
   * submit-application.handler.ts and portal-submit-application.handler.ts.
   */
  canSubmit(): boolean {
    return this.status === ApplicationStatus.DRAFT;
  }

  canEdit(): boolean {
    return this.status === ApplicationStatus.DRAFT;
  }

  canWithdraw(): boolean {
    return [
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.INTERVIEW_SCHEDULED,
      ApplicationStatus.WAITLISTED,
    ].includes(this.status);
  }

  canReview(): boolean {
    return [
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.INTERVIEW_SCHEDULED,
    ].includes(this.status);
  }

  isInReviewableState(): boolean {
    return this.status === ApplicationStatus.SUBMITTED ||
           this.status === ApplicationStatus.UNDER_REVIEW;
  }

  isCompleted(): boolean {
    return [
      ApplicationStatus.ACCEPTED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ].includes(this.status);
  }

  /**
   * Domain Methods
   */

  submit(): void {
    if (!this.canSubmit()) {
      throw new Error(`Cannot submit application in ${this.status} status`);
    }
    this.status = ApplicationStatus.SUBMITTED;
    this.submittedAt = new Date();
  }

  moveToReview(): void {
    if (this.status !== ApplicationStatus.SUBMITTED) {
      throw new Error(`Cannot move to review from ${this.status} status`);
    }
    this.status = ApplicationStatus.UNDER_REVIEW;
  }

  scheduleInterview(): void {
    if (!this.canReview()) {
      throw new Error(`Cannot schedule interview in ${this.status} status`);
    }
    this.status = ApplicationStatus.INTERVIEW_SCHEDULED;
  }

  accept(reviewerId: string, notes?: string): void {
    if (!this.canReview()) {
      throw new Error(`Cannot accept application in ${this.status} status`);
    }
    this.status = ApplicationStatus.ACCEPTED;
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.reviewerNotes = notes;
  }

  reject(reviewerId: string, notes?: string): void {
    if (!this.canReview()) {
      throw new Error(`Cannot reject application in ${this.status} status`);
    }
    this.status = ApplicationStatus.REJECTED;
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.reviewerNotes = notes;
  }

  waitlist(): void {
    if (!this.canReview()) {
      throw new Error(`Cannot waitlist application in ${this.status} status`);
    }
    this.status = ApplicationStatus.WAITLISTED;
  }

  withdraw(userId: string): void {
    if (!this.canWithdraw()) {
      throw new Error(`Cannot withdraw application in ${this.status} status`);
    }
    this.status = ApplicationStatus.WITHDRAWN;
  }

  updateScore(total: number, breakdown: ScoreBreakdown, status: ScoreStatus): void {
    this.scoreTotal = total;
    this.scoreBreakdown = breakdown;
    this.scoreStatus = status;
  }

  addStatusToHistory(newStatus: ApplicationStatus, changedBy: string, notes?: string): void {
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    
    this.statusHistory.push({
      status: newStatus,
      changedAt: new Date().toISOString(),
      changedBy,
      reason: notes,
    });
  }
}
