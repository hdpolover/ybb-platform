// Shared TypeScript types for Application entities

export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
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
