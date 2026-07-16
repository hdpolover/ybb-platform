import { Ambassador } from '../../entities/ambassador.entity';

export interface IAmbassadorRepository {
    findByUserId(userId: string): Promise<Ambassador | null>;
    create(data: Partial<Ambassador>): Promise<Ambassador>;
    update(userId: string, data: Partial<Ambassador>): Promise<Ambassador>;
    findByReferralCode(code: string): Promise<Ambassador | null>;
}
