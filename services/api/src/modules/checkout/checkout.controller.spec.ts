// services/api/src/modules/checkout/checkout.controller.spec.ts
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { CheckoutController } from './checkout.controller';

const editions = [
    {
        programSlug: 'meys-6',
        programName: 'MEYS 6th',
        registrationDates: { open: null, close: '2026-12-01T00:00:00.000Z' },
        options: [
            { category: 'fully_funded', tierId: 'ff6', tierName: 'FF', amount: 10, currency: 'USD', amountIdr: 165000 },
            { category: 'self_funded', tierId: 'sf6', tierName: 'SF', amount: 15, currency: 'USD' },
        ],
    },
    {
        programSlug: 'meys-7',
        programName: 'MEYS 7th',
        registrationDates: { open: null, close: null },
        options: [{ category: 'self_funded', tierId: 'sf7', tierName: 'SF', amount: 15, currency: 'USD' }],
    },
];

describe('CheckoutController.getConfig', () => {
    const policy = { resolveBrandId: jest.fn(), listOffers: jest.fn() };
    const env: Record<string, string | undefined> = {};
    const config = { get: (k: string) => env[k] };
    const controller = new CheckoutController(policy as never, config as never);

    beforeEach(() => {
        jest.resetAllMocks();
        for (const k of Object.keys(env)) delete env[k];
        env.CHECKOUT_ENABLED = 'true';
        env.TURNSTILE_SITE_KEY = 'site-key';
        policy.resolveBrandId.mockResolvedValue('b');
        policy.listOffers.mockResolvedValue(editions);
    });

    it('returns no editions and never queries when the flag is off', async () => {
        env.CHECKOUT_ENABLED = 'false';
        await expect(controller.getConfig({}, 'meys.org')).resolves.toEqual({
            enabled: false,
            turnstileSiteKey: 'site-key',
            editions: [],
            selected: null,
        });
        expect(policy.listOffers).not.toHaveBeenCalled();
    });

    it('treats anything but the literal "true" as off', async () => {
        env.CHECKOUT_ENABLED = '1';
        expect((await controller.getConfig({}, 'meys.org')).enabled).toBe(false);
    });

    it('returns the brand editions with selected null when nothing is preselected', async () => {
        const res = await controller.getConfig({}, 'meys.org');
        expect(res).toEqual({ enabled: true, turnstileSiteKey: 'site-key', editions, selected: null });
        expect(policy.resolveBrandId).toHaveBeenCalledWith('meys.org');
        expect(policy.listOffers).toHaveBeenCalledWith('b');
    });

    it('resolves selected from a valid preselect and takes the category from the option', async () => {
        const res = await controller.getConfig({ programSlug: 'meys-6', tierId: 'sf6' }, 'meys.org');
        expect(res.selected).toEqual({ programSlug: 'meys-6', category: 'self_funded', tierId: 'sf6' });
    });

    it.each([
        ['unknown tier', { programSlug: 'meys-6', tierId: 'nope' }],
        ['unknown program', { programSlug: 'nope', tierId: 'sf6' }],
        ['tier from another edition', { programSlug: 'meys-7', tierId: 'sf6' }],
        ['category the tier is not offered under', { programSlug: 'meys-6', tierId: 'sf6', category: 'fully_funded' as const }],
        ['slug without tier', { programSlug: 'meys-6' }],
    ])('gives selected null for an invalid preselect: %s', async (_name, query) => {
        expect((await controller.getConfig(query, 'meys.org')).selected).toBeNull();
    });

    it('gives selected null when a multi-category tier is preselected without a category', async () => {
        policy.listOffers.mockResolvedValue([
            {
                ...editions[0],
                options: [
                    { category: 'fully_funded', tierId: 'both', tierName: 'Both', amount: 10, currency: 'USD' },
                    { category: 'self_funded', tierId: 'both', tierName: 'Both', amount: 10, currency: 'USD' },
                ],
            },
        ]);
        expect((await controller.getConfig({ programSlug: 'meys-6', tierId: 'both' }, 'x')).selected).toBeNull();
        expect(
            (await controller.getConfig({ programSlug: 'meys-6', tierId: 'both', category: 'self_funded' }, 'x')).selected,
        ).toEqual({ programSlug: 'meys-6', category: 'self_funded', tierId: 'both' });
    });

    it('throttles per IP on both the default and long tiers', () => {
        const handler = CheckoutController.prototype.getConfig;
        for (const tierName of ['default', 'long']) {
            expect(Reflect.getMetadata(THROTTLER_LIMIT + tierName, handler)).toBe(120);
            expect(Reflect.getMetadata(THROTTLER_TTL + tierName, handler)).toBe(900000);
        }
    });
});
