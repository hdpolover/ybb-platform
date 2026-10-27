// services/api/src/modules/checkout/checkout.controller.spec.ts
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { CheckoutController } from './checkout.controller';

const offer = {
    brandId: 'b',
    programId: 'p',
    programName: 'MEYS 2026',
    programSlug: 'meys-2026',
    tierId: 't',
    tierName: 'Fully Funded',
    category: 'fully_funded' as const,
    amount: 10,
    currency: 'USD',
    amountUsd: 10,
    amountIdr: 165000,
    exchangeRate: 16500,
};

describe('CheckoutController.getConfig', () => {
    const policy = { resolveBrandId: jest.fn(), resolveOffer: jest.fn() };
    const env: Record<string, string | undefined> = {};
    const config = { get: (k: string) => env[k] };
    const controller = new CheckoutController(policy as never, config as never);
    const query = { programSlug: 'meys-2026', tierId: 't' };

    beforeEach(() => {
        jest.resetAllMocks();
        for (const k of Object.keys(env)) delete env[k];
        policy.resolveBrandId.mockResolvedValue('b');
        policy.resolveOffer.mockResolvedValue(offer);
    });

    it('returns no quote and never queries when the flag is off', async () => {
        env.TURNSTILE_SITE_KEY = 'site-key';
        await expect(controller.getConfig(query, 'meys.org')).resolves.toEqual({
            enabled: false,
            quote: null,
            turnstileSiteKey: 'site-key',
        });
        expect(policy.resolveOffer).not.toHaveBeenCalled();
    });

    it('treats anything but the literal "true" as off', async () => {
        env.CHECKOUT_ENABLED = '1';
        expect((await controller.getConfig(query, 'meys.org')).enabled).toBe(false);
    });

    it('returns the quote, with amountIdr, when enabled', async () => {
        env.CHECKOUT_ENABLED = 'true';
        env.TURNSTILE_SITE_KEY = 'site-key';
        const res = await controller.getConfig(query, 'meys.org');
        expect(res).toEqual({
            enabled: true,
            quote: {
                programName: 'MEYS 2026',
                programSlug: 'meys-2026',
                tierId: 't',
                tierName: 'Fully Funded',
                category: 'fully_funded',
                amount: 10,
                currency: 'USD',
                amountIdr: 165000,
            },
            turnstileSiteKey: 'site-key',
        });
        expect(policy.resolveBrandId).toHaveBeenCalledWith('meys.org');
        expect(policy.resolveOffer).toHaveBeenCalledWith({ brandId: 'b', programSlug: 'meys-2026', tierId: 't', category: undefined });
    });

    it('omits amountIdr when the tier has no IDR price and nulls a missing site key', async () => {
        env.CHECKOUT_ENABLED = 'true';
        policy.resolveOffer.mockResolvedValue({ ...offer, amountIdr: null });
        const res = await controller.getConfig(query, 'meys.org');
        expect(res.quote).not.toHaveProperty('amountIdr');
        expect(res.turnstileSiteKey).toBeNull();
    });

    it('throttles per IP on both the default and long tiers', () => {
        const handler = CheckoutController.prototype.getConfig;
        for (const tierName of ['default', 'long']) {
            expect(Reflect.getMetadata(THROTTLER_LIMIT + tierName, handler)).toBe(120);
            expect(Reflect.getMetadata(THROTTLER_TTL + tierName, handler)).toBe(900000);
        }
    });
});
