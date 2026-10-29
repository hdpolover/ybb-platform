// services/api/src/modules/users/application/utils/marketing-consent.util.ts
import { Prisma } from '@prisma/client';

export const MARKETING_CONSENT_TYPE = 'marketing_emails';

/** Bump when the wording below changes, so each audit row maps to the text the person saw. */
export const MARKETING_CONSENT_VERSION = '2026-10-29';

/** Canonical wording; the portal shows a translation of it. Stored on every audit row. */
export const MARKETING_CONSENT_TEXT = 'Send me updates about upcoming YBB programs';

export type MarketingConsentContext = { ipAddress?: string; userAgent?: string };

type ConsentClient = Pick<Prisma.TransactionClient, 'userPrivacyConsent'>;

/**
 * Append-only audit row for a marketing-email opt-in or opt-out. Takes the client so
 * callers can run it inside their own transaction. Not swallowed: an opt-in without
 * proof of consent must not stick.
 */
export async function recordMarketingConsent(
  client: ConsentClient,
  userId: string,
  isGranted: boolean,
  ctx: MarketingConsentContext = {},
): Promise<void> {
  const now = new Date();
  await client.userPrivacyConsent.create({
    data: {
      userId,
      consentType: MARKETING_CONSENT_TYPE,
      consentVersion: MARKETING_CONSENT_VERSION,
      consentText: MARKETING_CONSENT_TEXT,
      isGranted,
      grantedAt: isGranted ? now : null,
      revokedAt: isGranted ? null : now,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });
}
