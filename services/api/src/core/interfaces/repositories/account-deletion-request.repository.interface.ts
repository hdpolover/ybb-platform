import { AccountDeletionRequest } from '@core/entities/account-deletion-request.entity';

export interface IAccountDeletionRequestRepository {
    findByUserId(userId: string): Promise<AccountDeletionRequest | null>;
    // "Active" = pending (legacy, pre-self-service rows only) or approved
    // (auto-scheduled, not yet purged/cancelled) - anything a new deletion
    // request must be blocked from duplicating.
    findActiveByUserId(userId: string): Promise<AccountDeletionRequest | null>;
}

export const IAccountDeletionRequestRepository = Symbol('IAccountDeletionRequestRepository');
