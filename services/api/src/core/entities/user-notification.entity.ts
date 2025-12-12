/**
 * User Notification Domain Entity
 */

export class UserNotification {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public type: string,
        public title: string,
        public message: string,
        public actionUrl: string | null,
        public actionLabel: string | null,
        public relatedEntityType: string | null,
        public relatedEntityId: string | null,
        public metadata: any,
        public isRead: boolean,
        public readAt: Date | null,
        public priority: 'low' | 'normal' | 'high' | 'urgent',
        public sentViaEmail: boolean,
        public sentViaSms: boolean,
        public emailSentAt: Date | null,
        public smsSentAt: Date | null,
        public readonly createdAt: Date,
        public expiresAt: Date | null,
        public deletedAt: Date | null,
    ) { }
}
