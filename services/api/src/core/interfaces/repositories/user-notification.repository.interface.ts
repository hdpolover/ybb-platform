import { UserNotification } from '@core/entities/user-notification.entity';

export interface IUserNotificationRepository {
    findByUserId(userId: string, skip?: number, take?: number, type?: string, isRead?: boolean): Promise<UserNotification[]>;
    countByUserId(userId: string, type?: string, isRead?: boolean): Promise<number>;
    findById(id: string): Promise<UserNotification | null>;
    markAsRead(id: string, readAt: Date): Promise<UserNotification>;
    create(notification: UserNotification): Promise<UserNotification>;
}

export const IUserNotificationRepository = Symbol('IUserNotificationRepository');
