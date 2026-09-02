import { ApplicationStatus, ApplicationCategory, ScoreStatus } from '@core/entities/participant-application.entity';

export class ExportApplicationsQuery {
    constructor(
        /** Scope-checked by the controller; undefined means "not filtered by brand". */
        public readonly brandId?: string,
        public readonly programId?: string,
        public readonly status?: ApplicationStatus,
        public readonly category?: ApplicationCategory,
        public readonly search?: string,
        public readonly startDate?: string,
        public readonly endDate?: string,
        public readonly scoreStatus?: ScoreStatus,
        /** Set for callers scoped to specific programs instead of a whole brand. */
        public readonly programIds?: string[],
    ) { }
}
