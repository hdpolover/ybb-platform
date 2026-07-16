export class UserActivityLog {
    constructor(
        public readonly id: string,
        public readonly userId: string | null,
        public activityType: string,
        public activityCategory: string | null,
        public activityData: Record<string, unknown>,
        public pageUrl: string | null,
        public referrerUrl: string | null,
        public sessionId: string | null,
        public ipAddress: string | null,
        public userAgent: string | null,
        public deviceType: string | null,
        public readonly createdAt: Date,
    ) { }
}
