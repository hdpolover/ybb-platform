export class Sponsor {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly type: string,
        public readonly logoUrl: string | null,
        public readonly websiteUrl: string | null,
        public readonly description: string | null,
        public readonly tier: string | null,
        public readonly order: number,
        public readonly isActive: boolean,
    ) { }
}
