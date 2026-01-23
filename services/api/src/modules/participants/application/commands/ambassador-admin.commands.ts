export class GetAmbassadorsListQuery {
    constructor(
        public readonly programId?: string,
        public readonly search?: string,
        public readonly page: number = 1,
        public readonly limit: number = 20,
    ) {}
}

export class UpdateAmbassadorStatusCommand {
    constructor(
        public readonly ambassadorId: string,
        public readonly isActive: boolean,
    ) {}
}
