// src/modules/participants/application/queries/resolve-referral-attribution.query.ts
export class ResolveReferralAttributionQuery {
    constructor(
        public readonly code: string,
        /**
         * Program the caller belongs to. Ambassadors hold one code per
         * BRAND (not per program), so this is resolved to that program's
         * brand and scoped to it when known; otherwise stay unscoped rather
         * than guessing and hiding a legitimate attribution.
         */
        public readonly programId?: string,
    ) {}
}
