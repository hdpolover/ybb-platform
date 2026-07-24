import { Injectable } from '@nestjs/common';

/**
 * Minimal application shape a document audience check needs. Callers pass in
 * whatever fields their Prisma `select` already fetched — this service never
 * queries the database itself.
 */
export interface DocumentAudienceApplication {
    status: string;
    submittedAt?: Date | string | null;
    registrationPaymentStatus: string;
    programPaymentStatus: string;
    pricingTierId: string | null;
    invoices: { pricingTierId: string; status: string }[];
}

export interface DocumentAudienceTemplate {
    audienceType: string;
    audienceConfig: unknown;
}

// Mirrors LoaEligibilityService: only submitted or accepted applications count as "submitted".
const SUBMITTED_APPLICATION_STATUSES = ['submitted', 'accepted'] as const;

/**
 * Determines whether a participant's application satisfies a document
 * template's audience rule (`DocumentTemplate.audienceType`).
 *
 * Security-critical: this gates who can see/download program documents.
 * Unknown/unrecognised audience types MUST fail closed (not eligible) — never
 * default to permissive.
 */
@Injectable()
export class DocumentAudienceService {
    isEligible(
        tmpl: DocumentAudienceTemplate,
        application: DocumentAudienceApplication,
    ): boolean {
        const config = (tmpl.audienceConfig ?? {}) as Record<string, unknown>;
        switch (tmpl.audienceType) {
            case 'all_registered':
                return true;
            case 'paid_any':
                return this.isPaid(application);
            case 'paid_pricing_tier': {
                const ids = (config.pricingTierIds as string[]) ?? [];
                return application.invoices.some(
                    (inv) => inv.status === 'paid' && ids.includes(inv.pricingTierId),
                );
            }
            case 'specific_status': {
                const statuses = (config.statuses as string[]) ?? [];
                return statuses.includes(application.status);
            }
            case 'submitted_and_paid':
                return this.isSubmitted(application) && this.isPaid(application);
            default:
                // Fail closed: an unrecognised audienceType never grants access.
                return false;
        }
    }

    private isSubmitted(application: DocumentAudienceApplication): boolean {
        const isSubmittedStatus = SUBMITTED_APPLICATION_STATUSES.includes(
            application.status as (typeof SUBMITTED_APPLICATION_STATUSES)[number],
        );
        return isSubmittedStatus && Boolean(application.submittedAt);
    }

    private isPaid(application: DocumentAudienceApplication): boolean {
        return (
            application.registrationPaymentStatus === 'paid' ||
            application.programPaymentStatus === 'paid'
        );
    }
}
