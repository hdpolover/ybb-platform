import { ApplicationStatus, ApplicationCategory, ScoreStatus } from '@core/entities/participant-application.entity';

export class ExportApplicationsQuery {
    constructor(
        public readonly brandId: string,
        public readonly programId?: string,
        public readonly status?: ApplicationStatus,
        public readonly category?: ApplicationCategory,
        public readonly search?: string,
        public readonly startDate?: string,
        public readonly endDate?: string,
        public readonly scoreStatus?: ScoreStatus,
    ) { }
}
