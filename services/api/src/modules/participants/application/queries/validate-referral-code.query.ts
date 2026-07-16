// src/modules/participants/application/queries/validate-referral-code.query.ts
export class ValidateReferralCodeQuery {
    constructor(
        public readonly code: string,
        /**
         * Program the participant is joining. Ambassadors belong to exactly one
         * program, so a code from another program must not validate here. Optional:
         * when the caller cannot say which program this is for, the check stays
         * unscoped rather than guessing and rejecting a legitimate code.
         */
        public readonly programId?: string,
    ) {}
}
