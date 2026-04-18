export class RemoveBrandAdminCommand {
    constructor(
        public readonly brandId: string,
        public readonly adminId: string,
    ) {}
}
