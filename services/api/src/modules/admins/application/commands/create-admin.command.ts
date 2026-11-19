
export class CreateAdminCommand {
    constructor(
        public readonly email: string,
        public readonly fullName: string,
        /** null = no usable password (access-request approval; the user sets one via a link). */
        public readonly password: string | null,
        public readonly createdBy: string, // Admin ID of creator
        public readonly roleId?: string,
        public readonly brandIds?: string[],
        public readonly programIds?: string[],
        /** User row's home brand; wins over the first program's brand. */
        public readonly homeBrandId?: string,
        /** Attach the admin to this existing (active, admin-less) user row instead of creating one. */
        public readonly existingUserId?: string,
    ) { }
}
