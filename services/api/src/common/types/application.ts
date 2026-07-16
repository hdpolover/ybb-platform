// Shared TypeScript types for Application entities

export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

/** A file uploaded as part of an application requirement or document. */
export interface DocumentFile {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedAt?: string;
}

/** One entry in an application's status-change history. */
export interface ApplicationStatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}

export interface Application {
  id: string;
  userId: string;
  programId: string;
  status: ApplicationStatus;
  answers: ApplicationAnswer[];
  documents: string[];
  paymentId?: string;
  paymentStatus?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationAnswer {
  questionId: string;
  question: string;
  answer: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'file';
}

export interface CreateApplicationDto {
  userId: string;
  programId: string;
  answers: ApplicationAnswer[];
  documents?: string[];
}

export interface UpdateApplicationDto {
  answers?: ApplicationAnswer[];
  documents?: string[];
  status?: ApplicationStatus;
}

export interface ReviewApplicationDto {
  status: ApplicationStatus;
  reviewNotes: string;
}

export interface ApplicationWithDetails extends Application {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  program: {
    id: string;
    title: string;
    type: string;
    fee: number;
  };
}
