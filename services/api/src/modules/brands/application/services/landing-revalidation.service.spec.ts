import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { lookup } from 'node:dns/promises';
import { LandingRevalidationService } from './landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Audit M211: post() now resolves the target hostname via DNS before
// sending. Mocked here so these tests exercise real HTTP-call wiring
// without a real network lookup - defaults to "everything resolves public"
// so the pre-existing tests (written before the SSRF guard existed) keep
// asserting what they always asserted. The dedicated SSRF describe block
// below overrides this per-test to prove the guard itself.
jest.mock('node:dns/promises', () => ({
    lookup: jest.fn(),
}));

const makeHttpService = () => ({
    post: jest.fn().mockReturnValue(of({ data: { revalidated: true } })),
});

// Every hostname used by the pre-existing tests below must be allow-listed
// here (Audit M211 - an unlisted origin is now rejected before the POST is
// even attempted), matching this file's existing fixtures exactly rather
// than widening the allowlist to something more permissive.
const DEFAULT_ALLOWED_ORIGINS = [
    'https://istanbulyouthsummit.com',
    'https://websiteurl.com',
    'https://landingurl.com',
    'https://fallback.example.com',
].join(',');

const makeConfigService = (overrides: Record<string, string> = {}) => ({
    get: jest.fn((key: string, fallback = '') => {
        const map: Record<string, string> = {
            LANDING_URL: '',
            SETTINGS_REVALIDATE_SECRET: 'settings-secret',
            HOME_REVALIDATE_SECRET: 'home-secret',
            LANDING_REVALIDATION_ALLOWED_ORIGINS: DEFAULT_ALLOWED_ORIGINS,
            ...overrides,
        };
        return map[key] ?? fallback;
    }),
});

const makePrismaService = (brand: { websiteUrl: string | null; landingUrl: string | null } | null = null) => ({
    brand: {
        findUnique: jest.fn().mockResolvedValue(brand),
    },
});

async function buildService(
    httpService: ReturnType<typeof makeHttpService>,
    configService: ReturnType<typeof makeConfigService>,
    prismaService: ReturnType<typeof makePrismaService>,
): Promise<LandingRevalidationService> {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            LandingRevalidationService,
            { provide: HttpService, useValue: httpService },
            { provide: ConfigService, useValue: configService },
            { provide: PrismaService, useValue: prismaService },
        ],
    }).compile();
    return module.get<LandingRevalidationService>(LandingRevalidationService);
}

describe('LandingRevalidationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (lookup as jest.Mock).mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    });

    describe('revalidateHomeAndSettingsForBrand', () => {
        it('POSTs to both /api/home/revalidate and /api/settings/revalidate with brandDomain', async () => {
            // Arrange
            const http = makeHttpService();
            const config = makeConfigService();
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            // Act
            await service.revalidateHomeAndSettingsForBrand('brand-123');

            // Assert: two POST calls made
            expect(http.post).toHaveBeenCalledTimes(2);

            const calls = (http.post as jest.Mock).mock.calls;
            const urls = calls.map((c: any[]) => c[0]);

            expect(urls).toContain(
                'https://istanbulyouthsummit.com/api/settings/revalidate?brandDomain=istanbulyouthsummit.com',
            );
            expect(urls).toContain(
                'https://istanbulyouthsummit.com/api/home/revalidate?brandDomain=istanbulyouthsummit.com',
            );
        });

        it('sends the correct Bearer secrets for each route', async () => {
            // Arrange
            const http = makeHttpService();
            const config = makeConfigService({
                SETTINGS_REVALIDATE_SECRET: 'settings-secret',
                HOME_REVALIDATE_SECRET: 'home-secret',
            });
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            // Act
            await service.revalidateHomeAndSettingsForBrand('brand-123');

            // Assert: correct secrets per route
            const calls = (http.post as jest.Mock).mock.calls as Array<[string, unknown, { headers: Record<string, string> }]>;
            const byRoute = (route: string) =>
                calls.find(([url]) => url.includes(`/api/${route}/revalidate`));

            const settingsCall = byRoute('settings');
            const homeCall = byRoute('home');

            expect(settingsCall?.[2].headers['Authorization']).toBe('Bearer settings-secret');
            expect(homeCall?.[2].headers['Authorization']).toBe('Bearer home-secret');
        });

        it('prefers landingUrl over websiteUrl when both are set', async () => {
            // Arrange
            const http = makeHttpService();
            const config = makeConfigService();
            const prisma = makePrismaService({
                websiteUrl: 'https://websiteurl.com',
                landingUrl: 'https://landingurl.com',
            });
            const service = await buildService(http, config, prisma);

            // Act
            await service.revalidateHomeAndSettingsForBrand('brand-abc');

            // Assert: URLs use landingUrl's host
            const calls = (http.post as jest.Mock).mock.calls as Array<[string]>;
            expect(calls.every(([url]) => url.startsWith('https://landingurl.com'))).toBe(true);
            expect(calls.every(([url]) => url.includes('brandDomain=landingurl.com'))).toBe(true);
        });

        it('skips revalidation and makes no POST calls when brand has no usable URL', async () => {
            // Arrange
            const http = makeHttpService();
            const config = makeConfigService({ LANDING_URL: '' });
            const prisma = makePrismaService({ websiteUrl: null, landingUrl: null });
            const service = await buildService(http, config, prisma);

            // Act
            await service.revalidateHomeAndSettingsForBrand('brand-nourl');

            // Assert
            expect(http.post).not.toHaveBeenCalled();
        });

        it('falls back to LANDING_URL env var when brand has no URLs', async () => {
            // Arrange
            const http = makeHttpService();
            const config = makeConfigService({ LANDING_URL: 'https://fallback.example.com' });
            const prisma = makePrismaService({ websiteUrl: null, landingUrl: null });
            const service = await buildService(http, config, prisma);

            // Act
            await service.revalidateHomeAndSettingsForBrand('brand-fallback');

            // Assert
            expect(http.post).toHaveBeenCalledTimes(2);
            const calls = (http.post as jest.Mock).mock.calls as Array<[string]>;
            expect(calls.every(([url]) => url.startsWith('https://fallback.example.com'))).toBe(true);
        });

        it('swallows HTTP errors and does not throw', async () => {
            // Arrange
            const http = makeHttpService();
            (http.post as jest.Mock).mockReturnValue(throwError(() => ({ message: 'ECONNREFUSED', response: null })));
            const config = makeConfigService();
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            // Act + Assert: must not throw
            await expect(service.revalidateHomeAndSettingsForBrand('brand-123')).resolves.toBeUndefined();
        });
    });

    describe('revalidateForBrand (existing behaviour unchanged)', () => {
        it('POSTs to /api/settings/revalidate with brandDomain', async () => {
            // Arrange
            const http = makeHttpService();
            const config = makeConfigService();
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            // Act
            await service.revalidateForBrand('brand-123');

            // Assert: exactly one POST to settings
            expect(http.post).toHaveBeenCalledTimes(1);
            const [url] = (http.post as jest.Mock).mock.calls[0] as [string];
            expect(url).toBe(
                'https://istanbulyouthsummit.com/api/settings/revalidate?brandDomain=istanbulyouthsummit.com',
            );
        });

        it('skips when no URL resolves', async () => {
            const http = makeHttpService();
            const config = makeConfigService({ LANDING_URL: '' });
            const prisma = makePrismaService(null);
            const service = await buildService(http, config, prisma);

            await service.revalidateForBrand('brand-xyz');

            expect(http.post).not.toHaveBeenCalled();
        });
    });

    // Audit M211 (SSRF): landingUrl/websiteUrl are admin-settable and only
    // @IsUrl-validated, so an attacker (or a fat-fingered admin) can point
    // this at an internal service, localhost, or the cloud metadata address.
    // The Bearer secret must never be sent to a target that fails either
    // check.
    describe('SSRF guard', () => {
        it('never sends the request when the origin is not in LANDING_REVALIDATION_ALLOWED_ORIGINS', async () => {
            const http = makeHttpService();
            const config = makeConfigService();
            const prisma = makePrismaService({ websiteUrl: 'https://attacker.example.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            await service.revalidateForBrand('brand-attacker');

            expect(http.post).not.toHaveBeenCalled();
        });

        it('never sends the request when the hostname resolves to a private/loopback address (metadata SSRF)', async () => {
            (lookup as jest.Mock).mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
            const http = makeHttpService();
            // Origin allow-listed, but its DNS answer is the metadata address -
            // the resolve step must still reject it.
            const config = makeConfigService({
                LANDING_REVALIDATION_ALLOWED_ORIGINS: 'https://istanbulyouthsummit.com',
            });
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            await service.revalidateForBrand('brand-rebind');

            expect(http.post).not.toHaveBeenCalled();
        });

        it('never sends the Authorization header anywhere when a target is rejected', async () => {
            const http = makeHttpService();
            const config = makeConfigService();
            const prisma = makePrismaService({ websiteUrl: 'https://attacker.example.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            await service.revalidateForBrand('brand-attacker');

            expect(http.post).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.anything() }) }),
            );
        });

        it('still sends the request when both the origin allowlist and DNS resolution pass', async () => {
            const http = makeHttpService();
            const config = makeConfigService();
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            await service.revalidateForBrand('brand-ok');

            expect(http.post).toHaveBeenCalledTimes(1);
        });

        it('rejects when DNS resolution fails closed (NXDOMAIN/timeout)', async () => {
            (lookup as jest.Mock).mockRejectedValue(new Error('ENOTFOUND'));
            const http = makeHttpService();
            const config = makeConfigService();
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            await service.revalidateForBrand('brand-nxdomain');

            expect(http.post).not.toHaveBeenCalled();
        });

        it('rejects every target when LANDING_REVALIDATION_ALLOWED_ORIGINS is unset, rather than defaulting open', async () => {
            const http = makeHttpService();
            const config = makeConfigService({ LANDING_REVALIDATION_ALLOWED_ORIGINS: '' });
            const prisma = makePrismaService({ websiteUrl: 'https://istanbulyouthsummit.com', landingUrl: null });
            const service = await buildService(http, config, prisma);

            await service.revalidateForBrand('brand-noallowlist');

            expect(http.post).not.toHaveBeenCalled();
        });
    });
});
