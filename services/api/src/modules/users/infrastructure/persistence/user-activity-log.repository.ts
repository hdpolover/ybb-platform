import { Injectable } from '@nestjs/common';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserActivityLogRepository implements IUserActivityLogRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string, skip?: number, take?: number): Promise<UserActivityLog[]> {
        const logs = await this.prisma.userActivityLog.findMany({
            where: { userId },
            ...(skip !== undefined && { skip }),
            ...(take !== undefined && { take }),
            orderBy: { createdAt: 'desc' },
        });

        return logs.map(this.toDomain);
    }

    async countByUserId(userId: string): Promise<number> {
        return this.prisma.userActivityLog.count({
            where: { userId },
        });
    }

    async create(log: UserActivityLog): Promise<UserActivityLog> {
        const created = await this.prisma.userActivityLog.create({
            data: {
                userId: log.userId,
                activityType: log.activityType,
                activityCategory: log.activityCategory,
                activityData: (log.activityData ?? {}) as Prisma.InputJsonValue,
                pageUrl: log.pageUrl,
                referrerUrl: log.referrerUrl,
                sessionId: log.sessionId,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                deviceType: log.deviceType,
            },
        });

        return this.toDomain(created);
    }

    private toDomain(orm: Prisma.UserActivityLogGetPayload<Record<string, never>>): UserActivityLog {
        return new UserActivityLog(
            orm.id,
            orm.userId,
            orm.activityType,
            orm.activityCategory,
            orm.activityData as unknown as Record<string, unknown>,
            orm.pageUrl,
            orm.referrerUrl,
            orm.sessionId,
            orm.ipAddress,
            orm.userAgent,
            orm.deviceType,
            orm.createdAt,
        );
    }
}
