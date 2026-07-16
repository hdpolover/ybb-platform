import { Injectable, Inject } from '@nestjs/common';
import { ListUserSecurityLogsQuery } from '../list-user-logs.query';
import { UserSecurityLogResponseDto } from '../../../presentation/dto/user-logs.dto';
import { IUserSecurityLogRepository } from '@core/interfaces/repositories/user-security-log.repository.interface';
import { UserSecurityLog } from '@core/entities/user-security-log.entity';

@Injectable()
export class ListUserSecurityLogsHandler {
    constructor(
        @Inject(IUserSecurityLogRepository)
        private readonly userSecurityLogRepository: IUserSecurityLogRepository,
    ) { }

    async execute(query: ListUserSecurityLogsQuery): Promise<{ data: UserSecurityLogResponseDto[], total: number, page: number, limit: number }> {
        const skip = (query.page - 1) * query.limit;
        const logs = await this.userSecurityLogRepository.findByUserId(
            query.userId,
            skip,
            query.limit
        );
        const total = await this.userSecurityLogRepository.countByUserId(query.userId);

        return {
            data: logs.map(this.mapToDto),
            total,
            page: query.page,
            limit: query.limit,
        };
    }

    private mapToDto(log: UserSecurityLog): UserSecurityLogResponseDto {
        return {
            id: log.id,
            eventType: log.eventType,
            eventStatus: log.eventStatus,
            eventDescription: log.eventDescription ?? undefined,
            ipAddress: log.ipAddress ?? undefined,
            userAgent: log.userAgent ?? undefined,
            location: log.location ?? undefined,
            riskLevel: log.riskLevel ?? undefined,
            flagged: log.flagged,
            createdAt: log.createdAt,
        };
    }
}
