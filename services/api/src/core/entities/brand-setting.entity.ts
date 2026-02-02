export class BrandSetting {
    constructor(
        public readonly id: string,
        public readonly brandId: string,
        public readonly isMaintenanceMode: boolean,
        public readonly maintenanceMessage: string | null,
        public readonly maintenanceScheduledEnd: Date | null,
        public readonly footerNavigation: any,
        public readonly usdInIdr: number,
        public readonly googleAnalyticsId: string | null,
        public readonly pixelId: string | null,
        public readonly supportEmail: string | null,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly deletedAt: Date | null,
    ) { }
}
