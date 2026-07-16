import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListSystemAnnouncementsQuery } from '../list-system-announcements.query';
import { ISystemAnnouncementRepository } from '@core/interfaces/repositories/system-announcement.repository.interface';
import { SystemAnnouncementResponseDto } from '@modules/system/presentation/dto/system-announcement.dto';

@QueryHandler(ListSystemAnnouncementsQuery)
export class ListSystemAnnouncementsHandler implements IQueryHandler<ListSystemAnnouncementsQuery> {
    constructor(
        @Inject('ISystemAnnouncementRepository')
        private readonly repository: ISystemAnnouncementRepository,
    ) { }

    async execute(query: ListSystemAnnouncementsQuery): Promise<SystemAnnouncementResponseDto[]> {
        const announcements = await this.repository.findAll({ isPublished: query.isPublished });

        return announcements.map(a => ({
            id: a.id,
            title: a.title,
            content: a.content,
            summary: a.summary || undefined,
            type: a.type,
            priority: a.priority,
            publishedAt: a.publishedAt!,
            createdAt: a.createdAt,
        }));
    }
}
