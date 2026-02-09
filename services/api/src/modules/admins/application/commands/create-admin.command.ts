
export class CreateAdminCommand {
    constructor(
        public readonly email: string,
        public readonly fullName: string,
        public readonly password: string,
        public readonly createdBy: string, // Admin ID of creator
        public readonly roleId?: string,
        public readonly brandIds?: string[],
    ) { }
}
