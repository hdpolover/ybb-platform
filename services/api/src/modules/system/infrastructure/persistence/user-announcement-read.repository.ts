import { Injectable } from '@nestjs/common';
import { IUserAnnouncementReadRepository } from '@core/interfaces/repositories/user-announcement-read.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class UserAnnouncementReadRepository implements IUserAnnouncementReadRepository {
    constructor(private readonly prisma: PrismaService) { }

    async markAsRead(userId: string, announcementId: string): Promise<void> {
        await this.prisma.userAnnouncementRead.upsert({
            where: {
                userId_announcementId: {
                    userId,
                    announcementId
                }
            },
            create: {
                userId,
                announcementId,
                lastSeenAt: new Date(),
            },
            update: {
                lastSeenAt: new Date(),
            },
        });
    }

    async markAsDismissed(userId: string, announcementId: string): Promise<void> {
        await this.prisma.userAnnouncementRead.upsert({
            where: {
                userId_announcementId: {
                    userId,
                    announcementId
                }
            },
            create: {
                userId,
                announcementId,
                isDismissed: true,
                dismissedAt: new Date(),
                lastSeenAt: new Date(),
            },
            update: {
                isDismissed: true,
                dismissedAt: new Date(),
            },
        });
    }
}
