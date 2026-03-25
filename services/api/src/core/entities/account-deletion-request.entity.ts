export class AccountDeletionRequest {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public reason: string | null,
        public reasonCategory: string | null,
        public status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled',
        public reviewedBy: string | null,
        public reviewedAt: Date | null,
        public reviewNotes: string | null,
        public scheduledDeletionDate: Date | null,
        public actualDeletionDate: Date | null,
        public dataSnapshot: Record<string, unknown>,
        public deletionLog: Record<string, unknown>,
        public ipAddress: string | null,
        public userAgent: string | null,
        public readonly createdAt: Date,
        public updatedAt: Date,
    ) { }
}
