export class UpdateUserPreferencesCommand {
    constructor(
        public readonly userId: string,
        public readonly updates: {
            theme?: 'light' | 'dark' | 'auto';
            language?: string;
            timezone?: string;
            dateFormat?: string;
            emailNotifications?: boolean;
            smsNotifications?: boolean;
            marketingEmails?: boolean;
            newsletterSubscription?: boolean;
            programUpdates?: boolean;
            applicationUpdates?: boolean;
            reminderEmails?: boolean;
            customSettings?: any;
        }
    ) { }
}
