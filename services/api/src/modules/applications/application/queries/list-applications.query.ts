import { ApplicationStatus, ScoreStatus } from '@core/entities/participant-application.entity';
import { PaymentStatus } from '@prisma/client';

export type ListApplicationsSortBy =
  | 'updatedAt'
  | 'createdAt'
  | 'submittedAt'
  | 'participantName'
  | 'country'
  | 'status'
  | 'registrationPaymentStatus'
  | 'programPaymentStatus'
  | 'scoreTotal'
  | 'scoreStatus';

export type ListApplicationsSortOrder = 'asc' | 'desc';

/**
 * List Applications Query
 * 
 * Application Layer - Query
 */
export class ListApplicationsQuery {
  constructor(
    public readonly filters: {
      brandId?: string;
      programId?: string;
      participantId?: string;
      status?: ApplicationStatus;
      category?: string;
      search?: string;
      country?: string;
      registrationPaymentStatus?: PaymentStatus;
      programPaymentStatus?: PaymentStatus;
      scoreStatus?: ScoreStatus;
      sortBy?: ListApplicationsSortBy;
      sortOrder?: ListApplicationsSortOrder;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    },
  ) {}
}
