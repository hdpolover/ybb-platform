export class RestoreAdminCommand {
    constructor(
        public readonly id: string,
        public readonly restoredBy: string
    ) { }
}
