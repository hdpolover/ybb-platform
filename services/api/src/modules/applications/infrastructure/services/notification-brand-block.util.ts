// src/modules/applications/infrastructure/services/notification-brand-block.util.ts
import { Prisma } from '@prisma/client';

type BrandWithSettings = Prisma.BrandGetPayload<{ include: { settings: true } }>;

interface ProgramContact {
  contactEmail: string | null;
  contactAddress: string | null;
}

/** The brand block lifecycle-email payloads carry so the notification service can theme the email. */
export function buildNotificationBrandBlock(
  brand: BrandWithSettings | null | undefined,
  program: ProgramContact | null | undefined,
) {
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
