// services/api/src/modules/checkout/checkout-policy.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    CHECKOUT_AMOUNT_INVALID,
    CHECKOUT_CATEGORY_REQUIRED,
    CHECKOUT_PROGRAM_CLOSED,
    CheckoutPolicyService,
} from './checkout-policy.service';

const BRAND = 'brand-1';
const TIER = '11111111-1111-4111-8111-111111111111';
const DAY = 86_400_000;

const tier = (over: Record<string, unknown> = {}) => ({
    id: TIER,
    name: 'Fully Funded Registration',
    price: '10.00',
    currency: 'USD',
    usdPrice: '10.00',
    idrPrice: '165000',
    feeType: 'registration_fee',
    isActive: true,
    deletedAt: null,
    allowedCategories: ['fully_funded'],
    validityPeriods: [] as { startDate: Date; endDate: Date }[],
    ...over,
});

const program = (over: Record<string, unknown> = {}, tiers = [tier()]) => ({
    id: 'prog-1',
    name: 'MEYS 2026',
    slug: 'meys-2026',
    status: 'published',
    isPublished: true,
    isActive: true,
    allowRegistration: true,
    registrationOpenDate: null,
    registrationCloseDate: null,
    usdInIdr: '16500',
    pricingTiers: tiers,
    ...over,
});

describe('CheckoutPolicyService', () => {
    const prisma = {
        program: { findFirst: jest.fn(), findMany: jest.fn() },
        brand: { findFirst: jest.fn() },
        brandSetting: { findFirst: jest.fn() },
    };
    let service: CheckoutPolicyService;
    const resolve = (over: Record<string, unknown> = {}) =>
        service.resolveOffer({ brandId: BRAND, programSlug: 'meys-2026', tierId: TIER, ...over });

    beforeEach(() => {
        jest.resetAllMocks();
        service = new CheckoutPolicyService(prisma as never);
        prisma.program.findFirst.mockResolvedValue(program());
    });

    it('scopes the program lookup to the request brand and 404s on a wrong brand', async () => {
        prisma.program.findFirst.mockResolvedValue(null);
        await expect(resolve({ brandId: 'other-brand' })).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.program.findFirst.mock.calls[0][0].where).toEqual({ brandId: 'other-brand', slug: 'meys-2026' });
    });

    it('rejects a program that is not open for registration', async () => {
        prisma.program.findFirst.mockResolvedValue(program({ allowRegistration: false }));
        await expect(resolve()).rejects.toMatchObject({ response: { errorCode: CHECKOUT_PROGRAM_CLOSED } });
    });

    it('rejects when the tier window has closed', async () => {
        const closed = tier({ validityPeriods: [{ startDate: new Date(Date.now() - 10 * DAY), endDate: new Date(Date.now() - 2 * DAY) }] });
        prisma.program.findFirst.mockResolvedValue(program({}, [closed]));
        await expect(resolve()).rejects.toMatchObject({ response: { errorCode: 'REGISTRATION_WINDOW_CLOSED' } });
    });

    it('rejects a tier that belongs to the other category when the category has tiers of its own', async () => {
        const selfFunded = tier({ id: 'self-tier', allowedCategories: ['self_funded'], usdPrice: '15.00' });
        prisma.program.findFirst.mockResolvedValue(program({}, [tier(), selfFunded]));
        await expect(resolve({ category: 'self_funded' })).rejects.toMatchObject({
            response: { errorCode: 'REGISTRATION_FEE_CATEGORY_MISMATCH' },
        });
    });

    it('requires a category when the tier allows several', async () => {
        prisma.program.findFirst.mockResolvedValue(program({}, [tier({ allowedCategories: ['fully_funded', 'self_funded'] })]));
        await expect(resolve()).rejects.toMatchObject({ response: { errorCode: CHECKOUT_CATEGORY_REQUIRED } });
    });

    it('404s non-registration, inactive and deleted tiers: the query excludes them so they are absent', async () => {
        // pricingTiers is pre-filtered to registration_fee; a full_fee tier id never appears.
        prisma.program.findFirst.mockResolvedValue(program({}, []));
        await expect(resolve()).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.program.findFirst.mock.calls[0][0].select.pricingTiers.where).toEqual({
            isActive: true,
            deletedAt: null,
            feeType: 'registration_fee',
        });
    });

    it('404s a tier id that is not on this program', async () => {
        await expect(resolve({ tierId: '22222222-2222-4222-8222-222222222222' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns USD amount, IDR snapshot and rate straight from the DB on the happy path', async () => {
        const offer = await resolve();
        expect(offer).toEqual({
            brandId: BRAND,
            programId: 'prog-1',
            programName: 'MEYS 2026',
            programSlug: 'meys-2026',
            tierId: TIER,
            tierName: 'Fully Funded Registration',
            category: 'fully_funded',
            amount: 10,
            currency: 'USD',
            amountUsd: 10,
            amountIdr: 165000,
            exchangeRate: 16500,
        });
        expect(prisma.brandSetting.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to the brand setting rate for a USD offer without a program rate', async () => {
        prisma.program.findFirst.mockResolvedValue(program({ usdInIdr: null }));
        prisma.brandSetting.findFirst.mockResolvedValue({ usdInIdr: '16000' });
        expect((await resolve()).exchangeRate).toBe(16000);
    });

    it('uses the legacy price and currency when the tier has no usdPrice', async () => {
        prisma.program.findFirst.mockResolvedValue(program({}, [tier({ usdPrice: null, idrPrice: null, price: '250000', currency: 'IDR' })]));
        const offer = await resolve();
        expect(offer).toMatchObject({ amount: 250000, currency: 'IDR', amountUsd: null, amountIdr: null });
    });

    it('refuses a zero amount', async () => {
        prisma.program.findFirst.mockResolvedValue(program({}, [tier({ usdPrice: '0.00', price: '0.00' })]));
        await expect(resolve()).rejects.toMatchObject({ response: { errorCode: CHECKOUT_AMOUNT_INVALID } });
    });

    it('needs a program id or slug', async () => {
        await expect(service.resolveOffer({ brandId: BRAND, tierId: TIER })).rejects.toBeInstanceOf(BadRequestException);
    });

    describe('listOffers', () => {
        const edition = (slug: string, name: string, over: Record<string, unknown> = {}) =>
            program(
                { id: `id-${slug}`, slug, name, ...over },
                [
                    tier({ id: `ff-${slug}`, allowedCategories: ['fully_funded'], usdPrice: '10.00' }),
                    tier({ id: `sf-${slug}`, name: 'Self Funded Registration', allowedCategories: ['self_funded'], usdPrice: '15.00', idrPrice: null }),
                ],
            );

        it('lists every open edition with a fully funded and self funded option each', async () => {
            prisma.program.findMany.mockResolvedValue([edition('meys-6', 'MEYS 6th'), edition('meys-7', 'MEYS 7th')]);
            const res = await service.listOffers(BRAND);
            expect(res.map((e) => e.programSlug)).toEqual(['meys-6', 'meys-7']);
            expect(res[0].options).toEqual([
                { category: 'fully_funded', tierId: 'ff-meys-6', tierName: 'Fully Funded Registration', amount: 10, currency: 'USD', amountIdr: 165000 },
                { category: 'self_funded', tierId: 'sf-meys-6', tierName: 'Self Funded Registration', amount: 15, currency: 'USD' },
            ]);
            expect(res[0].registrationDates).toEqual({ open: null, close: null });
            expect(prisma.program.findMany.mock.calls[0][0].where).toMatchObject({ brandId: BRAND, status: 'published', allowRegistration: true });
        });

        it('excludes an edition whose registration dates have passed', async () => {
            prisma.program.findMany.mockResolvedValue([
                edition('meys-6', 'MEYS 6th', { registrationCloseDate: new Date(Date.now() - DAY) }),
                edition('meys-7', 'MEYS 7th', { registrationCloseDate: new Date(Date.now() + DAY) }),
            ]);
            const res = await service.listOffers(BRAND);
            expect(res.map((e) => e.programSlug)).toEqual(['meys-7']);
            expect(res[0].registrationDates.close).toEqual(expect.any(String));
        });

        it('drops an option whose fee window closed but keeps the rest of the edition', async () => {
            const closedWindow = [{ startDate: new Date(Date.now() - 10 * DAY), endDate: new Date(Date.now() - 2 * DAY) }];
            prisma.program.findMany.mockResolvedValue([
                program({}, [
                    tier({ id: 'ff', allowedCategories: ['fully_funded'], validityPeriods: closedWindow }),
                    tier({ id: 'sf', allowedCategories: ['self_funded'], usdPrice: '15.00' }),
                ]),
            ]);
            const res = await service.listOffers(BRAND);
            expect(res[0].options.map((o) => o.tierId)).toEqual(['sf']);
        });

        it('excludes an edition with no valid option at all', async () => {
            prisma.program.findMany.mockResolvedValue([program({}, [])]);
            await expect(service.listOffers(BRAND)).resolves.toEqual([]);
        });

        it('emits only the categories a tier allows, never an off-category pairing', async () => {
            prisma.program.findMany.mockResolvedValue([program({}, [tier({ allowedCategories: ['fully_funded'] })])]);
            const res = await service.listOffers(BRAND);
            expect(res[0].options.map((o) => o.category)).toEqual(['fully_funded']);
        });

        it('offers an empty-allowedCategories tier under both categories', async () => {
            prisma.program.findMany.mockResolvedValue([program({}, [tier({ allowedCategories: [] })])]);
            const res = await service.listOffers(BRAND);
            expect(res[0].options.map((o) => o.category)).toEqual(['fully_funded', 'self_funded']);
        });
    });

    describe('resolveBrandId', () => {
        it('refuses a missing domain instead of defaulting to a brand', async () => {
            await expect(service.resolveBrandId(undefined)).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.brand.findFirst).not.toHaveBeenCalled();
        });
        it('resolves by exact then contains match', async () => {
            prisma.brand.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: BRAND });
            await expect(service.resolveBrandId('meys.org')).resolves.toBe(BRAND);
        });
        it('400s an unknown domain', async () => {
            prisma.brand.findFirst.mockResolvedValue(null);
            await expect(service.resolveBrandId('nope.org')).rejects.toBeInstanceOf(BadRequestException);
        });
    });
});
