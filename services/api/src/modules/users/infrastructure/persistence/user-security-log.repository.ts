import { Injectable } from '@nestjs/common';
import { IUserSecurityLogRepository } from '@core/interfaces/repositories/user-security-log.repository.interface';
import { UserSecurityLog } from '@core/entities/user-security-log.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RiskLevel, Prisma } from '@prisma/client';

@Injectable()
export class UserSecurityLogRepository implements IUserSecurityLogRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string, skip?: number, take?: number): Promise<UserSecurityLog[]> {
        const logs = await this.prisma.userSecurityLog.findMany({
            where: { userId },
            ...(skip !== undefined && { skip }),
            ...(take !== undefined && { take }),
            orderBy: { createdAt: 'desc' },
        });

        return logs.map(this.toDomain);
    }

    async countByUserId(userId: string): Promise<number> {
        return this.prisma.userSecurityLog.count({
            where: { userId },
        });
    }

    async create(log: UserSecurityLog): Promise<UserSecurityLog> {
        const created = await this.prisma.userSecurityLog.create({
            data: {
                userId: log.userId,
                eventType: log.eventType,
                eventStatus: log.eventStatus,
                eventDescription: log.eventDescription,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                deviceFingerprint: log.deviceFingerprint,
                location: log.location,
                riskLevel: log.riskLevel as RiskLevel,
                flagged: log.flagged,
            },
        });

        return this.toDomain(created);
    }

    private toDomain(orm: Prisma.UserSecurityLogGetPayload<Record<string, never>>): UserSecurityLog {
        return new UserSecurityLog(
            orm.id,
            orm.userId,
            orm.eventType,
            orm.eventStatus,
            orm.eventDescription,
            orm.ipAddress,
            orm.userAgent,
            orm.deviceFingerprint,
            orm.location,
            orm.riskLevel,
            orm.flagged,
            orm.createdAt,
        );
    }
}
