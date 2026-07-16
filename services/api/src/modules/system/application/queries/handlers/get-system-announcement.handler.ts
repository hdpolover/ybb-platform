import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetSystemAnnouncementQuery } from '../get-system-announcement.query';
import { ISystemAnnouncementRepository } from '@core/interfaces/repositories/system-announcement.repository.interface';
import { SystemAnnouncementResponseDto } from '@modules/system/presentation/dto/system-announcement.dto';

@QueryHandler(GetSystemAnnouncementQuery)
export class GetSystemAnnouncementHandler implements IQueryHandler<GetSystemAnnouncementQuery> {
    constructor(
        @Inject('ISystemAnnouncementRepository')
        private readonly repository: ISystemAnnouncementRepository,
    ) { }

    async execute(query: GetSystemAnnouncementQuery): Promise<SystemAnnouncementResponseDto> {
        const announcement = await this.repository.findById(query.id);

        if (!announcement) {
            throw new NotFoundException('Announcement not found');
        }

        return {
            id: announcement.id,
            title: announcement.title,
            content: announcement.content,
            summary: announcement.summary || undefined,
            type: announcement.type,
            priority: announcement.priority,
            publishedAt: announcement.publishedAt!,
            createdAt: announcement.createdAt,
        };
    }
}
