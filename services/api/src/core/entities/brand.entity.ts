import { BrandSetting } from './brand-setting.entity';

export class Brand {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly slug: string,
        public readonly description: string | null,
        public readonly logoUrl: string | null,
        public readonly bannerUrl: string | null,
        public readonly websiteUrl: string | null,
        public readonly primaryColor: string | null,
        
        // Extended Details
        public readonly about: string | null,
        public readonly vision: string | null,
        public readonly mission: string | null,

        // Contact
        public readonly contactEmail: string | null,
        public readonly contactPhone: string | null,
        public readonly contactWhatsapp: string | null,
        public readonly contactAddress: string | null,
        public readonly socialMediaLinks: Record<string, string> | null,

        // Location
        public readonly defaultLocation: string | null,
        public readonly defaultCountry: string | null,
        public readonly defaultTimezone: string | null,

        // Configuration
        public readonly requireEmailVerification: boolean,
        public readonly defaultCurrency: string,
        public readonly enableMultiCurrency: boolean,

        // SEO
        public readonly metaTitle: string | null,
        public readonly metaDescription: string | null,
        public readonly metaKeywords: string | null,

        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly deletedAt: Date | null,
        public readonly isActive: boolean,

        // Relations
        public readonly settings?: BrandSetting | null,
        public readonly programCount?: number,
    ) { }
}
