import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { MarkAnnouncementReadCommand } from '../mark-announcement-read.command';
import { IUserAnnouncementReadRepository } from '@core/interfaces/repositories/user-announcement-read.repository.interface';

@CommandHandler(MarkAnnouncementReadCommand)
export class MarkAnnouncementReadHandler implements ICommandHandler<MarkAnnouncementReadCommand> {
    constructor(
        @Inject('IUserAnnouncementReadRepository')
        private readonly repository: IUserAnnouncementReadRepository,
    ) { }

    async execute(command: MarkAnnouncementReadCommand): Promise<void> {
        const { userId, announcementId, dismiss } = command;

        if (dismiss) {
            await this.repository.markAsDismissed(userId, announcementId);
        } else {
            await this.repository.markAsRead(userId, announcementId);
        }
    }
}
