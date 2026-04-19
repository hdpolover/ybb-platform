export class DeleteSponsorCommand {
    constructor(
        public readonly brandId: string,
        public readonly sponsorId: string,
    ) {}
}
