// services/api/src/modules/landing/strategies/settings.strategy.spec.ts
import { SettingsStrategy } from './settings.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { LandingSnapshotService } from '../services/landing-snapshot.service';
import { activeProgramQuery, anyProgramFallbackQuery } from '@shared/utils/active-program-resolver';

describe('SettingsStrategy', () => {
    let strategy: SettingsStrategy;
    let mockPrisma: any;
    let mockCache: any;
    let mockSnapshot: any;

    beforeEach(() => {
        mockPrisma = {
            brand: { findMany: jest.fn().mockResolvedValue([]) },
            program: { findFirst: jest.fn().mockResolvedValue(null) },
            brandSetting: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        mockCache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
        // getData() routes through LandingSnapshotService whenever `category`
        // is non-null — forward straight to the builder so these tests
        // exercise buildSettingsPayload's actual logic, not the snapshot
        // cache's own (separately-tested) behavior.
        mockSnapshot = {
            getOrBuildSettingsSnapshot: jest.fn().mockImplementation((_category: unknown, builder: () => Promise<unknown>) => builder()),
        };
        strategy = new SettingsStrategy(
            mockPrisma as PrismaService,
            mockCache as unknown as CacheService,
            mockSnapshot as unknown as LandingSnapshotService,
        );
    });

    // Brand-level contact columns still physically exist on this fixture
    // (Task 21 hasn't dropped them yet at this point in the migration) —
    // included deliberately so the assertions below can prove the strategy
    // no longer reads them, not merely that they're absent from the type.
    const category = {
        id: 'brand-1', name: 'Istanbul Youth Summit', logoUrl: 'logo.png', logoIconUrl: null,
        logoWhiteUrl: null, logoColorUrl: null, primaryColor: '#000', about: null, description: 'desc',
        defaultCurrency: 'USD', socialMediaLinks: null,
        contactEmail: 'brand-level@example.com', contactPhone: '+90-brand', contactWhatsapp: '90-brand', contactAddress: 'Brand Address',
    } as any;

    it('reads contact fields from the active PROGRAM, not the Brand, once one is resolved', async () => {
        mockPrisma.program.findFirst.mockResolvedValue({
            id: 'p1', name: 'IYS 2026', slug: 'iys-2026', year: 2026, usdInIdr: null,
            logoUrl: null, logoWhiteUrl: null, logoColorUrl: null, logoIconUrl: null, videoUrl: null,
            contactEmail: 'program@iys.com', contactPhone: '+90-program', contactWhatsapp: '90-program', contactAddress: 'Program Address',
        });

        const result: any = await strategy.getData(category);

        expect(result.brand.contact_phone).toBe('+90-program');
        expect(result.brand.contact_whatsapp).toBe('90-program');
        expect(result.brand.address).toBe('Program Address');
        expect(result.brand.support_email).toBe('program@iys.com');
        // Proves the Brand-level values on the fixture above did NOT leak through.
        expect(result.brand.contact_phone).not.toBe('+90-brand');
        expect(result.brand.address).not.toBe('Brand Address');
    });

    it('falls back to undefined contact fields (not the Brand columns) when there is no active program', async () => {
        mockPrisma.program.findFirst.mockResolvedValue(null);

        const result: any = await strategy.getData(category);

        expect(result.brand.contact_phone).toBeUndefined();
        expect(result.brand.contact_whatsapp).toBeUndefined();
        expect(result.brand.address).toBeUndefined();
        expect(result.brand.support_email).toBeUndefined();
    });

    it('support_email still prefers BrandSetting.supportEmail over the program contact email', async () => {
        mockPrisma.brandSetting.findUnique.mockResolvedValue({
            supportEmail: 'support@override.com', isMaintenanceMode: false, maintenanceMessage: null,
            maintenanceScheduledEnd: null, googleAnalyticsId: null, pixelId: null, footerNavigation: null,
        });
        mockPrisma.program.findFirst.mockResolvedValue({ id: 'p1', name: 'IYS 2026', contactEmail: 'program@iys.com' });

        const result: any = await strategy.getData(category);

        expect(result.brand.support_email).toBe('support@override.com');
    });

    it('favicon_url/apple_icon_url still come from Brand.metadata, unaffected by the contact-field switch', async () => {
        const categoryWithMeta = { ...category, metadata: { favicon_url: 'https://cdn/favicon.png', apple_icon_url: 'https://cdn/apple.png' } };
        mockPrisma.program.findFirst.mockResolvedValue(null);

        const result: any = await strategy.getData(categoryWithMeta);

        expect(result.brand.favicon_url).toBe('https://cdn/favicon.png');
        expect(result.brand.apple_icon_url).toBe('https://cdn/apple.png');
    });

    // The two real brands this whole change exists for (resolver addendum).
    // Both fail rule 1 (isPublished && isActive) and must recover via the
    // resolver's rule-2 fallback — proving buildSettingsPayload is wired to
    // resolveActiveProgram's full fallback, not just its rule-1 happy path.
    it('resolves contact info via rule-2 fallback for the Vietnam shape (published=true, isActive=false)', async () => {
        const vietnamProgram = {
            id: 'p-vys', name: 'Vietnam Youth Summit 2026', slug: 'vys-2026', year: 2026,
            isPublished: true, isActive: false,
            contactEmail: 'vys@ybbfoundation.com', contactPhone: '+84 123-456-789', contactWhatsapp: '84-123-456-789',
            contactAddress: 'Ho Chi Minh City & Hanoi, Vietnam',
        };
        mockPrisma.program.findFirst
            .mockResolvedValueOnce(null) // rule 1: isPublished && isActive finds nothing
            .mockResolvedValueOnce(vietnamProgram); // rule 2: most recent non-deleted program

        const result: any = await strategy.getData({ ...category, id: 'brand-vys' });

        expect(mockPrisma.program.findFirst).toHaveBeenNthCalledWith(1, activeProgramQuery('brand-vys'));
        expect(mockPrisma.program.findFirst).toHaveBeenNthCalledWith(2, anyProgramFallbackQuery('brand-vys'));
        expect(result.brand.support_email).toBe('vys@ybbfoundation.com');
        expect(result.brand.contact_phone).toBe('+84 123-456-789');
        expect(result.brand.address).toBe('Ho Chi Minh City & Hanoi, Vietnam');
    });

    it('resolves contact info via rule-2 fallback for the Korea shape (isPublished=false, isActive=true)', async () => {
        const koreaProgram = {
            id: 'p-kys', name: '4th Korea Youth Summit', slug: 'kys-4th', year: 2026,
            isPublished: false, isActive: true,
            contactEmail: 'koreayouthsummit@gmail.com', contactPhone: '+6285173386622', contactWhatsapp: 'wa.me/6285173386622',
            contactAddress: 'Seoul, South Korea',
        };
        mockPrisma.program.findFirst
            .mockResolvedValueOnce(null) // rule 1: isPublished && isActive finds nothing
            .mockResolvedValueOnce(koreaProgram); // rule 2: most recent non-deleted program

        const result: any = await strategy.getData({ ...category, id: 'brand-kys' });

        expect(mockPrisma.program.findFirst).toHaveBeenNthCalledWith(1, activeProgramQuery('brand-kys'));
        expect(mockPrisma.program.findFirst).toHaveBeenNthCalledWith(2, anyProgramFallbackQuery('brand-kys'));
        expect(result.brand.support_email).toBe('koreayouthsummit@gmail.com');
        expect(result.brand.contact_phone).toBe('+6285173386622');
        expect(result.brand.address).toBe('Seoul, South Korea');
    });
});
