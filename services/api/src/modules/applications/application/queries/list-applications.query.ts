import { ApplicationStatus } from '@core/entities/participant-application.entity';

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
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {}
}
