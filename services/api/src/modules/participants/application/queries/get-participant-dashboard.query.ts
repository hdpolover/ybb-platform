export class GetParticipantDashboardQuery {
    constructor(
        public readonly userId: string, // For ownership check
        public readonly participantId?: string,
    ) {}
}
