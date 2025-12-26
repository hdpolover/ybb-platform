import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { MarkNotificationReadCommand } from '../mark-notification-read.command';
import { UserNotificationResponseDto } from '../../../presentation/dto/user-notification.dto';
import { IUserNotificationRepository } from '@core/interfaces/repositories/user-notification.repository.interface';
import { UserNotification } from '@core/entities/user-notification.entity';

@Injectable()
export class MarkNotificationReadHandler {
    constructor(
        @Inject(IUserNotificationRepository)
        private readonly userNotificationRepository: IUserNotificationRepository,
    ) { }

    async execute(command: MarkNotificationReadCommand): Promise<UserNotificationResponseDto> {
        const notification = await this.userNotificationRepository.findById(command.notificationId);

        if (!notification) {
            throw new NotFoundException(`Notification not found`);
        }

        if (notification.userId !== command.userId) {
            throw new ForbiddenException(`You can only mark your own notifications as read`);
        }

        const updated = await this.userNotificationRepository.markAsRead(command.notificationId, new Date());

        return this.mapToDto(updated);
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
