// src/modules/meta/meta-capi.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { LandingService } from '../landing/landing.service';
import { MetaCapiService } from './meta-capi.service';
import { TikTokEventsService } from './tiktok-events.service';

describe('MetaCapiService.emitServerEvent', () => {
    let service: MetaCapiService;
    let prisma: { brandSetting: { findUnique: jest.Mock }; brand: { findUnique: jest.Mock } };
    let tiktokEventsService: { forwardEvent: jest.Mock };

    beforeEach(async () => {
        prisma = { brandSetting: { findUnique: jest.fn() }, brand: { findUnique: jest.fn() } };
        tiktokEventsService = { forwardEvent: jest.fn().mockResolvedValue({ forwarded: true }) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MetaCapiService,
                { provide: HttpService, useValue: { post: jest.fn() } },
                { provide: PrismaService, useValue: prisma },
                { provide: LandingService, useValue: { resolveBrand: jest.fn() } },
                { provide: TikTokEventsService, useValue: tiktokEventsService },
            ],
        }).compile();

        service = module.get(MetaCapiService);
    });

    it('never throws/rejects even when the underlying brand-settings lookup throws', async () => {
        // Simulates the "something unexpected" case the outer try/catch in
        // emitServerEvent guards against (sendToMeta/forwardEvent normally
        // swallow their own errors, but a DB error thrown before either call's
        // own try/catch must still never escape to the caller — a conversion-
        // tracking failure must never fail the payment/registration flow that
        // triggered it).
        prisma.brandSetting.findUnique.mockRejectedValue(new Error('connection reset'));

        await expect(
            service.emitServerEvent({
                brandId: 'brand-1',
                eventName: 'Purchase',
                eventId: 'purchase_inv-1',
                customData: { value: 100, currency: 'USD' },
            }),
        ).resolves.toBeUndefined();
    });

    it('bypasses the browser rate limiter (no host/ip involved) and never throws when brand has no CAPI configured', async () => {
        prisma.brandSetting.findUnique.mockResolvedValue(null);

        await expect(
            service.emitServerEvent({
                brandId: 'brand-1',
                eventName: 'ApplicationCreated',
                eventId: 'appcreated_app-1',
            }),
        ).resolves.toBeUndefined();
    });

    it('sends action_source "system_generated" for a server event with no eventSourceUrl, via the Graph payload', async () => {
        const { of } = await import('rxjs');
        const httpPost = jest.fn().mockReturnValue(of({ data: {} }));

        prisma.brandSetting.findUnique.mockResolvedValue({
            pixelId: 'pixel-1',
            capiAccessToken: 'token-1',
            capiTestEventCode: null,
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MetaCapiService,
                { provide: HttpService, useValue: { post: httpPost } },
                { provide: PrismaService, useValue: prisma },
                { provide: LandingService, useValue: { resolveBrand: jest.fn() } },
                { provide: TikTokEventsService, useValue: tiktokEventsService },
            ],
        }).compile();
        service = module.get(MetaCapiService);

        await service.emitServerEvent({
            brandId: 'brand-1',
            eventName: 'Purchase',
            eventId: 'purchase_inv-1',
            customData: { value: 100, currency: 'USD' },
        });

        expect(httpPost).toHaveBeenCalledWith(
            expect.stringContaining('/pixel-1/events'),
            expect.objectContaining({
                data: [expect.objectContaining({ action_source: 'system_generated' })],
            }),
            expect.anything(),
        );
    });

    it('replays stored fbp/fbc into Meta user_data AND switches to action_source "website" with a synthesized event_source_url', async () => {
        const { of } = await import('rxjs');
        const httpPost = jest.fn().mockReturnValue(of({ data: {} }));

        prisma.brandSetting.findUnique.mockResolvedValue({
            pixelId: 'pixel-1',
            capiAccessToken: 'token-1',
            capiTestEventCode: null,
        });
        prisma.brand.findUnique.mockResolvedValue({
            landingUrl: 'https://example-brand.org/',
            websiteUrl: null,
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MetaCapiService,
                { provide: HttpService, useValue: { post: httpPost } },
                { provide: PrismaService, useValue: prisma },
                { provide: LandingService, useValue: { resolveBrand: jest.fn() } },
                { provide: TikTokEventsService, useValue: tiktokEventsService },
            ],
        }).compile();
        service = module.get(MetaCapiService);

        await service.emitServerEvent({
            brandId: 'brand-1',
            eventName: 'Purchase',
            eventId: 'purchase_inv-2',
            customData: { value: 100, currency: 'USD' },
            fbp: 'fb.1.111.222',
            fbc: 'fb.1.111.click',
        });

        expect(httpPost).toHaveBeenCalledWith(
            expect.stringContaining('/pixel-1/events'),
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        action_source: 'website',
                        event_source_url: 'https://example-brand.org',
                        user_data: expect.objectContaining({ fbp: 'fb.1.111.222', fbc: 'fb.1.111.click' }),
                    }),
                ],
            }),
            expect.anything(),
        );

        // Same eventId/click-ids also reached TikTok's Events API in the same call.
        expect(tiktokEventsService.forwardEvent).toHaveBeenCalledWith(
            'brand-1',
            expect.objectContaining({ fbp: 'fb.1.111.222', fbc: 'fb.1.111.click' }),
            expect.anything(),
        );
    });

    it('replays stored ttp/ttclid through to TikTok (via forwardEvent)', async () => {
        prisma.brandSetting.findUnique.mockResolvedValue(null);

        await service.emitServerEvent({
            brandId: 'brand-1',
            eventName: 'ApplicationCreated',
            eventId: 'appcreated_app-2',
            ttp: 'tt.p.1',
            ttclid: 'tt-click-1',
        });

        expect(tiktokEventsService.forwardEvent).toHaveBeenCalledWith(
            'brand-1',
            expect.objectContaining({ ttp: 'tt.p.1', ttclid: 'tt-click-1' }),
            expect.anything(),
        );
    });

    it('stays "system_generated" (no brand lookup) when the event carries no click id at all', async () => {
        prisma.brandSetting.findUnique.mockResolvedValue(null);

        await service.emitServerEvent({
            brandId: 'brand-1',
            eventName: 'ApplicationCreated',
            eventId: 'appcreated_app-3',
        });

        expect(prisma.brand.findUnique).not.toHaveBeenCalled();
    });
});
