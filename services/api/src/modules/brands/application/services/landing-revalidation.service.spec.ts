import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { LandingRevalidationService } from './landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const makeHttpService = () => ({
    post: jest.fn().mockReturnValue(of({ data: { revalidated: true } })),
});

const makeConfigService = (overrides: Record<string, string> = {}) => ({
    get: jest.fn((key: string, fallback = '') => {
        const map: Record<string, string> = {
            LANDING_URL: '',
            SETTINGS_REVALIDATE_SECRET: 'settings-secret',
            HOME_REVALIDATE_SECRET: 'home-secret',
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
});
