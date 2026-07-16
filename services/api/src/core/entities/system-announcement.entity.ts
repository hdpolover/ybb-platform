export class SystemAnnouncement {
    constructor(
        public readonly id: string,
        public readonly title: string,
        public readonly content: string,
        public readonly summary: string | null,
        public readonly targetAudience: string,
        public readonly priority: string,
        public readonly type: string,
        public readonly isPublished: boolean,
        public readonly publishedAt: Date | null,
        public readonly isDismissible: boolean,
        public readonly showBanner: boolean,
        public readonly startDate: Date | null,
        public readonly endDate: Date | null,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
    ) { }
}
