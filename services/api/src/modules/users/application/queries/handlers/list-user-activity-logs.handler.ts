import { Injectable, Inject } from '@nestjs/common';
import { ListUserActivityLogsQuery } from '../list-user-logs.query';
import { UserActivityLogResponseDto } from '../../../presentation/dto/user-logs.dto';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';

@Injectable()
export class ListUserActivityLogsHandler {
    constructor(
        @Inject(IUserActivityLogRepository)
        private readonly userActivityLogRepository: IUserActivityLogRepository,
    ) { }

    async execute(query: ListUserActivityLogsQuery): Promise<{ data: UserActivityLogResponseDto[], total: number, page: number, limit: number }> {
        const skip = (query.page - 1) * query.limit;
        const logs = await this.userActivityLogRepository.findByUserId(
            query.userId,
            skip,
            query.limit
        );
        const total = await this.userActivityLogRepository.countByUserId(query.userId);

        return {
            data: logs.map(this.mapToDto),
            total,
            page: query.page,
            limit: query.limit,
        };
    }

    private mapToDto(log: UserActivityLog): UserActivityLogResponseDto {
        return {
            id: log.id,
            activityType: log.activityType,
            activityCategory: log.activityCategory ?? undefined,
            activityData: log.activityData,
            pageUrl: log.pageUrl ?? undefined,
            referrerUrl: log.referrerUrl ?? undefined,
            ipAddress: log.ipAddress ?? undefined,
            userAgent: log.userAgent ?? undefined,
            deviceType: log.deviceType ?? undefined,
            createdAt: log.createdAt,
        };
    }
}
