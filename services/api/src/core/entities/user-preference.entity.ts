/**
 * User Preference Domain Entity
 * 
 * Represents user settings and preferences.
 */

export class UserPreference {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public theme: 'light' | 'dark' | 'auto',
        public language: string,
        public timezone: string,
        public dateFormat: string,
        public emailNotifications: boolean,
        public smsNotifications: boolean,
        public marketingEmails: boolean,
        public newsletterSubscription: boolean,
        public programUpdates: boolean,
        public applicationUpdates: boolean,
        public reminderEmails: boolean,
        public customSettings: Record<string, unknown>,
        public readonly createdAt: Date,
        public updatedAt: Date,
    ) { }
}
