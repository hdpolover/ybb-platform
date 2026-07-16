export class UserSecurityLog {
    constructor(
        public readonly id: string,
        public readonly userId: string | null,
        public eventType: string,
        public eventStatus: string,
        public eventDescription: string | null,
        public ipAddress: string | null,
        public userAgent: string | null,
        public deviceFingerprint: string | null,
        public location: string | null,
        public riskLevel: 'low' | 'medium' | 'high' | 'critical' | null,
        public flagged: boolean,
        public readonly createdAt: Date,
    ) { }
}
