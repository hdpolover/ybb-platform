// src/modules/portal/application/utils/registration-fee-window.ts

/**
 * Whether a registration fee may be NEWLY invoiced or paid right now.
 *
 * Policy: a registration fee for a category is payable only while that
 * category's registration window is open. The window is the category's
 * registration_fee pricing tiers' validity periods, which is where admins set
 * the Fully Funded and Self Funded deadlines; there is no separate deadline
 * field. Before this, every payment path checked only that the tier was
 * active, and the payments list kept a lapsed tier on screen as payable
 * "overdue", so MEYS and CYS 2026 kept collecting the Fully Funded fee after
 * Fully Funded registration had closed.
 *
 * Resolution:
 *  1. The participant's category has registration tiers of its own: the
 *     category phase decides (getCategoryRegistrationPhase), whichever of
 *     those tiers is being paid.
 *  2. It has none ('unconfigured'), or there is no category: the phase of the
 *     tier being paid decides. This is the June 2026 fully_funded deadlock
 *     case (see ensure-portal-payment-invoice.handler.ts): a participant whose
 *     category has no tier must still be able to pay the programme's
 *     registration fee, so it is gated on that tier's own window instead of
 *     being refused outright.
 *
 * Programme registration dates are deliberately NOT passed: a tier with no
 * validity periods stays payable, as it always was. Admins who never set a
 * per-category window have not asked for payments to stop at the programme's
 * signup close date, and people who signed up on the last day routinely pay
 * afterwards.
 */

import {
    CategoryPhaseTier,
    CategoryRegistrationPhase,
    getCategoryRegistrationPhase,
    getTiersRegistrationPhase,
    isCategoryRegistrationAvailable,
} from '@shared/utils/tier-period.util';

export const REGISTRATION_WINDOW_CLOSED = 'REGISTRATION_WINDOW_CLOSED';
export const REGISTRATION_WINDOW_NOT_OPEN = 'REGISTRATION_WINDOW_NOT_OPEN';
export const REGISTRATION_FEE_CATEGORY_MISMATCH = 'REGISTRATION_FEE_CATEGORY_MISMATCH';

export type RegistrationFeeWindowInput = {
    /** The participant's application category, if any. */
    category: string | null | undefined;
    /** The registration_fee tier being invoiced or paid. */
    tier: CategoryPhaseTier;
    /** The programme's active, non-deleted registration_fee tiers. */
    registrationTiers: readonly CategoryPhaseTier[];
    now: Date;
};

export function resolveRegistrationFeePhase(input: RegistrationFeeWindowInput): CategoryRegistrationPhase {
    if (input.category) {
        const categoryPhase = getCategoryRegistrationPhase(input.registrationTiers, input.category, input.now);
        if (categoryPhase !== 'unconfigured') {
            return categoryPhase;
        }
    }
    return getTiersRegistrationPhase([input.tier], input.now);
}

/** True when the participant's category has registration tiers of its own and
 * `tier` is not one of them. An empty allowedCategories list is read as "every
 * category", as the payments list already does. */
export function isRegistrationFeeTierOffCategory(input: RegistrationFeeWindowInput): boolean {
    if (!input.category) return false;
    const allowed = input.tier.allowedCategories ?? [];
    if (allowed.length === 0 || allowed.includes(input.category)) return false;
    return getCategoryRegistrationPhase(input.registrationTiers, input.category, input.now) !== 'unconfigured';
}

export type RegistrationFeeWindowRejection = {
    errorCode: typeof REGISTRATION_WINDOW_CLOSED | typeof REGISTRATION_WINDOW_NOT_OPEN;
    message: string;
};

/** null when the fee may be invoiced/paid; otherwise the outcome code and
 * participant-facing message to reject with. */
export function getRegistrationFeeWindowRejection(
    input: RegistrationFeeWindowInput,
): RegistrationFeeWindowRejection | null {
    const phase = resolveRegistrationFeePhase(input);
    if (isCategoryRegistrationAvailable(phase)) return null;

    const label = categoryLabel(input.category);
    if (phase === 'upcoming') {
        return {
            errorCode: REGISTRATION_WINDOW_NOT_OPEN,
            message: `${label} registration has not opened yet, so this registration fee cannot be paid yet.`,
        };
    }
    return {
        errorCode: REGISTRATION_WINDOW_CLOSED,
        message: `${label} registration has closed, so this registration fee can no longer be paid.`,
    };
}

function categoryLabel(category: string | null | undefined): string {
    if (category === 'fully_funded') return 'Fully Funded';
    if (category === 'self_funded') return 'Self Funded';
    return 'This';
}
