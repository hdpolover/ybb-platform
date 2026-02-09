
export class DeleteAdminCommand {
    constructor(
        public readonly id: string,
        public readonly deletedBy: string
    ) { }
}
