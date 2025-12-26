import { Injectable, Inject } from '@nestjs/common';
import { ListUserNotificationsQuery } from '../list-user-notifications.query';
import { UserNotificationResponseDto } from '../../../presentation/dto/user-notification.dto';
import { IUserNotificationRepository } from '@core/interfaces/repositories/user-notification.repository.interface';
import { UserNotification } from '@core/entities/user-notification.entity';

@Injectable()
export class ListUserNotificationsHandler {
    constructor(
        @Inject(IUserNotificationRepository)
        private readonly userNotificationRepository: IUserNotificationRepository,
    ) { }

    async execute(query: ListUserNotificationsQuery): Promise<{ data: UserNotificationResponseDto[], total: number, page: number, limit: number }> {
        const skip = (query.page - 1) * query.limit;
        const notifications = await this.userNotificationRepository.findByUserId(
            query.userId,
            skip,
            query.limit,
            query.type,
            query.isRead
        );
        const total = await this.userNotificationRepository.countByUserId(query.userId, query.type, query.isRead);

        return {
            data: notifications.map(this.mapToDto),
            total,
            page: query.page,
            limit: query.limit,
        };
    }

    private mapToDto(n: UserNotification): UserNotificationResponseDto {
        return {
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            actionUrl: n.actionUrl ?? undefined,
            actionLabel: n.actionLabel ?? undefined,
            relatedEntityType: n.relatedEntityType ?? undefined,
            relatedEntityId: n.relatedEntityId ?? undefined,
            metadata: n.metadata,
            isRead: n.isRead,
            readAt: n.readAt ?? undefined,
            priority: n.priority,
            createdAt: n.createdAt,
        };
    }
}
