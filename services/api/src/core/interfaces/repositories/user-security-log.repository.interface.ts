import { UserSecurityLog } from '@core/entities/user-security-log.entity';

export interface IUserSecurityLogRepository {
    findByUserId(userId: string, skip?: number, take?: number): Promise<UserSecurityLog[]>;
    countByUserId(userId: string): Promise<number>;
    create(log: UserSecurityLog): Promise<UserSecurityLog>;
}

export const IUserSecurityLogRepository = Symbol('IUserSecurityLogRepository');
