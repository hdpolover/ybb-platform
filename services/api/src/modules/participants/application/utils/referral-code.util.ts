// src/modules/participants/application/utils/referral-code.util.ts

/**
 * Referral codes are stored uppercase and unpadded (verified: all 117 prod rows).
 * Every lookup path must normalize identically, or validation and attribution disagree.
 */
export function normalizeReferralCode(code: string | null | undefined): string {
    return code?.trim().toUpperCase() ?? '';
}
