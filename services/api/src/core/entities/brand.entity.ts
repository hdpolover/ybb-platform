export class Brand {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly slug: string,
        public readonly description: string | null,
        public readonly logoUrl: string | null,
        public readonly websiteUrl: string | null,
        public readonly primaryColor: string | null,
        public readonly contactEmail: string | null,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly deletedAt: Date | null,
        public readonly isActive: boolean,
    ) { }
}
