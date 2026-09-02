export class AssignBrandAdminCommand {
    constructor(
        public readonly brandId: string,
        public readonly adminId: string,
        public readonly roleInBrand: string | undefined,
        public readonly assignedBy: string,
    ) {}
}
