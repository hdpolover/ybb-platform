import { Injectable } from '@nestjs/common';
import { IUserPreferenceRepository } from '@core/interfaces/repositories/user-preference.repository.interface';
import { UserPreference } from '@core/entities/user-preference.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { Theme, Prisma } from '@prisma/client';

@Injectable()
export class UserPreferenceRepository implements IUserPreferenceRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string): Promise<UserPreference | null> {
        const pref = await this.prisma.userPreference.findUnique({
            where: { userId },
        });

        if (!pref) return null;

        return this.toDomain(pref);
    }

    async create(preference: UserPreference): Promise<UserPreference> {
        const created = await this.prisma.userPreference.create({
            data: {
                userId: preference.userId,
                theme: preference.theme as Theme,
                language: preference.language,
                timezone: preference.timezone,
                dateFormat: preference.dateFormat,
                emailNotifications: preference.emailNotifications,
                smsNotifications: preference.smsNotifications,
                marketingEmails: preference.marketingEmails,
                newsletterSubscription: preference.newsletterSubscription,
                programUpdates: preference.programUpdates,
                applicationUpdates: preference.applicationUpdates,
                reminderEmails: preference.reminderEmails,
                customSettings: (preference.customSettings ?? {}) as Prisma.InputJsonValue,
            },
        });

        return this.toDomain(created);
    }

    async update(preference: UserPreference): Promise<UserPreference> {
        const updated = await this.prisma.userPreference.update({
            where: { userId: preference.userId },
            data: {
                theme: preference.theme as Theme,
                language: preference.language,
                timezone: preference.timezone,
                dateFormat: preference.dateFormat,
                emailNotifications: preference.emailNotifications,
                smsNotifications: preference.smsNotifications,
                marketingEmails: preference.marketingEmails,
                newsletterSubscription: preference.newsletterSubscription,
                programUpdates: preference.programUpdates,
                applicationUpdates: preference.applicationUpdates,
                reminderEmails: preference.reminderEmails,
                customSettings: (preference.customSettings ?? {}) as Prisma.InputJsonValue,
                updatedAt: new Date(),
            },
        });

        return this.toDomain(updated);
    }

    private toDomain(ormEntity: Prisma.UserPreferenceGetPayload<Record<string, never>>): UserPreference {
        return new UserPreference(
            ormEntity.id,
            ormEntity.userId,
            ormEntity.theme,
            ormEntity.language,
            ormEntity.timezone,
            ormEntity.dateFormat,
            ormEntity.emailNotifications,
            ormEntity.smsNotifications,
            ormEntity.marketingEmails,
            ormEntity.newsletterSubscription,
            ormEntity.programUpdates,
            ormEntity.applicationUpdates,
            ormEntity.reminderEmails,
            ormEntity.customSettings as unknown as Record<string, unknown>,
            ormEntity.createdAt,
            ormEntity.updatedAt,
        );
    }
}
