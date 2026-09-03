export class GetAmbassadorsListQuery {
    constructor(
        public readonly programId?: string,
        public readonly search?: string,
        public readonly page: number = 1,
        public readonly limit: number = 20,
        public readonly sortBy?: string,
        public readonly sortOrder?: string,
        /**
         * Programmes the caller may see, or null for no restriction (platform
         * scope only). Applied by the handler rather than the controller because
         * `programId` may be a SLUG, and the handler is where that is resolved -
         * checking the raw value in the controller would reject a legitimate
         * slug. An empty array means "nothing", never "no filter".
         */
        public readonly allowedProgramIds: string[] | null = null,
    ) {}
}

export class UpdateAmbassadorStatusCommand {
    constructor(
        public readonly ambassadorId: string,
        public readonly isActive: boolean,
    ) {}
}

export class GetAmbassadorReferralsQuery {
    constructor(
        public readonly ambassadorId: string,
        public readonly page: number = 1,
        public readonly limit: number = 20,
    ) {}
}
