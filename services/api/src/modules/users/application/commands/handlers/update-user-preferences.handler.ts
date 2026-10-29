import { Injectable, Inject } from '@nestjs/common';
import { UpdateUserPreferencesCommand } from '../update-user-preferences.command';
import { UserPreferenceResponseDto } from '../../../presentation/dto/user-preference.dto';
import { IUserPreferenceRepository } from '@core/interfaces/repositories/user-preference.repository.interface';
import { UserPreference } from '@core/entities/user-preference.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { recordMarketingConsent } from '../../utils/marketing-consent.util';

@Injectable()
export class UpdateUserPreferencesHandler {
    constructor(
        @Inject(IUserPreferenceRepository)
        private readonly userPreferenceRepository: IUserPreferenceRepository,
        private readonly prisma: PrismaService,
    ) { }

    async execute(command: UpdateUserPreferencesCommand): Promise<UserPreferenceResponseDto> {
        let preferences = await this.userPreferenceRepository.findByUserId(command.userId);

        // Audit only a real change: clients resend the whole form, and an untouched
        // value is not a new consent event. Written first and not swallowed, so a
        // failed audit write leaves the preference as it was.
        const requested = command.updates.marketingEmails;
        if (requested !== undefined && requested !== (preferences?.marketingEmails ?? false)) {
            await recordMarketingConsent(this.prisma, command.userId, requested, command.consentContext);
        }

        if (!preferences) {
            // Create new if not exists
            preferences = new UserPreference(
                '',
                command.userId,
                'light', 'en', 'UTC', 'YYYY-MM-DD', true, false, false, false, true, true, true, {}, new Date(), new Date()
            );

            // Apply updates to default
            this.applyUpdates(preferences, command.updates);
            preferences = await this.userPreferenceRepository.create(preferences);
        } else {
            // Update existing
            this.applyUpdates(preferences, command.updates);
            preferences = await this.userPreferenceRepository.update(preferences);
        }

        return this.mapToDto(preferences);
    }

    private applyUpdates(pref: UserPreference, updates: UpdateUserPreferencesCommand['updates']) {
        if (updates.theme !== undefined) pref.theme = updates.theme;
        if (updates.language !== undefined) pref.language = updates.language;
        if (updates.timezone !== undefined) pref.timezone = updates.timezone;
        if (updates.dateFormat !== undefined) pref.dateFormat = updates.dateFormat;
        if (updates.emailNotifications !== undefined) pref.emailNotifications = updates.emailNotifications;
        if (updates.smsNotifications !== undefined) pref.smsNotifications = updates.smsNotifications;
        if (updates.marketingEmails !== undefined) pref.marketingEmails = updates.marketingEmails;
        if (updates.newsletterSubscription !== undefined) pref.newsletterSubscription = updates.newsletterSubscription;
        if (updates.programUpdates !== undefined) pref.programUpdates = updates.programUpdates;
        if (updates.applicationUpdates !== undefined) pref.applicationUpdates = updates.applicationUpdates;
        if (updates.reminderEmails !== undefined) pref.reminderEmails = updates.reminderEmails;
        if (updates.customSettings !== undefined) pref.customSettings = updates.customSettings;
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
