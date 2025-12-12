import { Injectable } from '@nestjs/common';
import { ISystemAnnouncementRepository } from '@core/interfaces/repositories/system-announcement.repository.interface';
import { SystemAnnouncement } from '@core/entities/system-announcement.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class SystemAnnouncementRepository implements ISystemAnnouncementRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(filters?: { isPublished?: boolean; targetAudience?: string }): Promise<SystemAnnouncement[]> {
        const where: any = {};
        if (filters?.isPublished !== undefined) {
            where.isPublished = filters.isPublished;
        }
        // Simple filter, can be expanded
        const announcements = await this.prisma.systemAnnouncement.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return announcements.map(this.mapToEntity);
    }

    async findById(id: string): Promise<SystemAnnouncement | null> {
        const announcement = await this.prisma.systemAnnouncement.findUnique({
            where: { id },
        });
        return announcement ? this.mapToEntity(announcement) : null;
    }

    private mapToEntity(prismaEntity: any): SystemAnnouncement {
        return new SystemAnnouncement(
            prismaEntity.id,
            prismaEntity.title,
            prismaEntity.content,
            prismaEntity.summary,
            prismaEntity.targetAudience,
            prismaEntity.priority,
            prismaEntity.type,
            prismaEntity.isPublished,
            prismaEntity.publishedAt,
            prismaEntity.isDismissible,
            prismaEntity.showBanner,
            prismaEntity.startDate,
            prismaEntity.endDate,
            prismaEntity.createdAt,
            prismaEntity.updatedAt,
        );
    }
}
