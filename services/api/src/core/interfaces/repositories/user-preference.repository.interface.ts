import { UserPreference } from '@core/entities/user-preference.entity';

/**
 * User Preference Repository Interface
 */

export interface IUserPreferenceRepository {
    findByUserId(userId: string): Promise<UserPreference | null>;

    update(preference: UserPreference): Promise<UserPreference>;

    create(preference: UserPreference): Promise<UserPreference>;
}

export const IUserPreferenceRepository = Symbol('IUserPreferenceRepository');
