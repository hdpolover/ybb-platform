export type NotificationBrandSource = {
    landingUrl?: string | null;
    name: string;
    primaryColor: string | null;
    logoUrl: string | null;
    websiteUrl: string | null;
    socialMediaLinks: unknown;
    settings?: { footerNavigation: unknown; supportEmail: string | null } | null;
} | null;

type ProgramContact = { contactEmail: string | null; contactAddress: string | null } | null | undefined;

/** Brand block the notification service uses for letterhead/footer; contact comes from the program. */
export function buildNotificationBrandPayload(program: ProgramContact, brand: NotificationBrandSource) {
    if (!brand) return null;
    return {
        name: brand.name,
        primaryColor: brand.primaryColor,
        logoUrl: brand.logoUrl,
        websiteUrl: brand.websiteUrl,
        contactEmail: program?.contactEmail ?? null,
        contactAddress: program?.contactAddress ?? null,
        socialMediaLinks: brand.socialMediaLinks,
        settings: brand.settings
            ? {
                footerNavigation: brand.settings.footerNavigation,
                supportEmail: brand.settings.supportEmail,
            }
            : null,
    };
}
