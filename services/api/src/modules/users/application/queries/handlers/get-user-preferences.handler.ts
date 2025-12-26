import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { GetUserPreferencesQuery } from '../get-user-preferences.query';
import { UserPreferenceResponseDto } from '../../../presentation/dto/user-preference.dto';
import { IUserPreferenceRepository } from '@core/interfaces/repositories/user-preference.repository.interface';
import { UserPreference } from '@core/entities/user-preference.entity';

@Injectable()
export class GetUserPreferencesHandler {
    constructor(
        @Inject(IUserPreferenceRepository)
        private readonly userPreferenceRepository: IUserPreferenceRepository,
    ) { }

    async execute(query: GetUserPreferencesQuery): Promise<UserPreferenceResponseDto> {
        const preferences = await this.userPreferenceRepository.findByUserId(query.userId);

        if (!preferences) {
            // Return default if not found
            return this.mapToDto(this.createDefaultPreferences(query.userId));
        }

        return this.mapToDto(preferences);
    }

    private createDefaultPreferences(userId: string): UserPreference {
        return new UserPreference(
            'default', // Temp ID, won't be saved unless updated
            userId,
            'light',
            'en',
            'UTC',
            'YYYY-MM-DD',
            true,
            false,
            false,
            false,
            true,
            true,
            true,
            {},
            new Date(),
            new Date()
        );
    }

    private mapToDto(pref: UserPreference): UserPreferenceResponseDto {
        return {
            id: pref.id,
            userId: pref.userId,
            theme: pref.theme,
            language: pref.language,
            timezone: pref.timezone,
            dateFormat: pref.dateFormat,
            emailNotifications: pref.emailNotifications,
            smsNotifications: pref.smsNotifications,
            marketingEmails: pref.marketingEmails,
            newsletterSubscription: pref.newsletterSubscription,
            programUpdates: pref.programUpdates,
            applicationUpdates: pref.applicationUpdates,
            reminderEmails: pref.reminderEmails,
            customSettings: pref.customSettings,
            updatedAt: pref.updatedAt,
        };
    }
}
