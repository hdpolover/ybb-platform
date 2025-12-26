import { AccountDeletionRequest } from '@core/entities/account-deletion-request.entity';

export interface IAccountDeletionRequestRepository {
    create(request: AccountDeletionRequest): Promise<AccountDeletionRequest>;
    findByUserId(userId: string): Promise<AccountDeletionRequest | null>;
    findPendingByUserId(userId: string): Promise<AccountDeletionRequest | null>;
}

export const IAccountDeletionRequestRepository = Symbol('IAccountDeletionRequestRepository');
