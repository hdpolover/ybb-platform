export class DeleteAmbassadorCommand {
    constructor(
        public readonly ambassadorId: string,
        public readonly deletedBy: string,
    ) {}
}
