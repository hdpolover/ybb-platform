import { Injectable } from '@nestjs/common';
import { IUserNotificationRepository } from '@core/interfaces/repositories/user-notification.repository.interface';
import { UserNotification } from '@core/entities/user-notification.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { NotificationPriority } from '@prisma/client';

@Injectable()
export class UserNotificationRepository implements IUserNotificationRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string, skip?: number, take?: number, type?: string, isRead?: boolean): Promise<UserNotification[]> {
        const where: any = { userId, deletedAt: null };
        if (type) where.type = type;
        if (isRead !== undefined) where.isRead = isRead;

        const notifications = await this.prisma.userNotification.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
        });

        return notifications.map(this.toDomain);
    }

    async countByUserId(userId: string, type?: string, isRead?: boolean): Promise<number> {
        const where: any = { userId, deletedAt: null };
        if (type) where.type = type;
        if (isRead !== undefined) where.isRead = isRead;

        return this.prisma.userNotification.count({ where });
    }

    async findById(id: string): Promise<UserNotification | null> {
        const notification = await this.prisma.userNotification.findUnique({
            where: { id },
        });
        return notification ? this.toDomain(notification) : null;
    }

    async markAsRead(id: string, readAt: Date): Promise<UserNotification> {
        const updated = await this.prisma.userNotification.update({
            where: { id },
            data: { isRead: true, readAt },
        });
        return this.toDomain(updated);
    }

    async create(n: UserNotification): Promise<UserNotification> {
        const created = await this.prisma.userNotification.create({
            data: {
                userId: n.userId,
                type: n.type,
                title: n.title,
                message: n.message,
                actionUrl: n.actionUrl,
                actionLabel: n.actionLabel,
                relatedEntityType: n.relatedEntityType,
                relatedEntityId: n.relatedEntityId,
                metadata: n.metadata ?? {},
                isRead: n.isRead,
                readAt: n.readAt,
                priority: n.priority as NotificationPriority,
                sentViaEmail: n.sentViaEmail,
                sentViaSms: n.sentViaSms,
                emailSentAt: n.emailSentAt,
                smsSentAt: n.smsSentAt,
                expiresAt: n.expiresAt,
            }
        });
        return this.toDomain(created);
    }

    private toDomain(orm: any): UserNotification {
        return new UserNotification(
            orm.id,
            orm.userId,
            orm.type,
            orm.title,
            orm.message,
            orm.actionUrl,
            orm.actionLabel,
            orm.relatedEntityType,
            orm.relatedEntityId,
            orm.metadata,
            orm.isRead,
            orm.readAt,
            orm.priority,
            orm.sentViaEmail,
            orm.sentViaSms,
            orm.emailSentAt,
            orm.smsSentAt,
            orm.createdAt,
            orm.expiresAt,
            orm.deletedAt,
        );
    }
}
