export class ProgramAward {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly description: string | null,
        public readonly category: string | null,
        public readonly badgeUrl: string | null,
        public readonly iconUrl: string | null,
    ) { }
}

export class ParticipantAward {
    constructor(
        public readonly id: string,
        public readonly applicationId: string,
        public readonly awardId: string,
        public readonly awardedAt: Date,
        public readonly notes: string | null,
        public readonly certificateUrl: string | null,
        // Relations
        public readonly awardName?: string,
        public readonly awardDescription?: string | null,
        public readonly awardBadgeUrl?: string | null,
    ) { }
}
