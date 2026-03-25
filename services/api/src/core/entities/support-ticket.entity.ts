export class SupportTicket {
    constructor(
        public readonly id: string,
        public readonly participantId: string,
        public readonly ticketNumber: string,
        public readonly category: string,
        public readonly subject: string,
        public readonly description: string,
        public readonly status: string,
        public readonly priority: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly subCategory?: string | null,
        public readonly assignedTo?: string | null,
        public readonly programId?: string | null,
        public readonly resolution?: string | null,
        public readonly resolvedAt?: Date | null,
        public readonly closedAt?: Date | null,
        public readonly satisfactionRating?: number | null,
        public readonly feedback?: string | null,
        // Relations
        public readonly messages?: SupportTicketMessage[],
    ) { }
}

export class SupportTicketMessage {
    constructor(
        public readonly id: string,
        public readonly ticketId: string,
        public readonly message: string,
        public readonly isFromAdmin: boolean,
        public readonly senderId: string,
        public readonly senderName: string,
        public readonly createdAt: Date,
        public readonly attachments: import('@core/entities/participant-application.entity').DocumentFile[] = [],
        public readonly isRead: boolean = false,
    ) { }
}
