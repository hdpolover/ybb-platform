import { UserActivityLog } from '@core/entities/user-activity-log.entity';

export interface IUserActivityLogRepository {
    findByUserId(userId: string, skip?: number, take?: number): Promise<UserActivityLog[]>;
    countByUserId(userId: string): Promise<number>;
    create(log: UserActivityLog): Promise<UserActivityLog>;
}

export const IUserActivityLogRepository = Symbol('IUserActivityLogRepository');
