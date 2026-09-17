import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EnsurePortalPaymentInvoiceHandler } from './ensure-portal-payment-invoice.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { EnsurePortalPaymentInvoiceCommand } from '../../queries/portal-queries';

// Shape actually observed against this project's real database (Prisma 7.3.0
// + @prisma/adapter-pg + Postgres, see prisma-error.util.ts's own docstring):
// meta.driverAdapterError.cause.constraint.fields carries the exact DB column
// names straight from Postgres's error detail.
function makeDuplicateTierInvoiceP2002(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
            driverAdapterError: {
                cause: { constraint: { fields: ['application_id', 'pricing_tier_id'] } },
            },
        } as unknown as Record<string, unknown>,
    });
}

describe('EnsurePortalPaymentInvoiceHandler', () => {
    let handler: EnsurePortalPaymentInvoiceHandler;

    const mockPrisma = {
        participantApplication: {
            findFirst: jest.fn(),
        },
        programPricingTier: {
            findFirst: jest.fn(),
        },
        applicationInvoice: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
    };

    const mockCacheService = {
        invalidateKey: jest.fn().mockResolvedValue(undefined),
    };

    const mockPortalCacheService = {
        getParticipantProfile: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EnsurePortalPaymentInvoiceHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
            ],
        }).compile();

        handler = module.get<EnsurePortalPaymentInvoiceHandler>(EnsurePortalPaymentInvoiceHandler);
        jest.clearAllMocks();
    });

    // Same wiring gap as save-submission-section, and this handler decides which
    // application an invoice is raised against - so resolving the wrong one bills
    // the wrong programme.
    it('resolves the application through the shared rule, not its own clause', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'participant-1', userId: 'user-1' });
        // Resolve nothing: we only care which query was issued. The handler then
        // throws, which is fine - the assertion is on the call it already made.
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

        await expect(
            handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'registration_fee', 'prog-1')),
        ).rejects.toThrow();

        const args = mockPrisma.participantApplication.findFirst.mock.calls[0][0];
        expect(args.where).toMatchObject({
            participantId: 'participant-1',
            programId: 'prog-1',
            deletedAt: null,
        });
        expect(args.orderBy[0]).toEqual({ withdrawnAt: { sort: 'asc', nulls: 'first' } });
    });

    it('stores the program exchange-rate snapshot on newly created USD invoices (legacy tier)', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            programId: 'program-1',
            applicationCategory: 'self_funded',
            program: {
                usdInIdr: '17580',
            },
        });
        mockPrisma.programPricingTier.findFirst.mockResolvedValue({
            id: 'tier-1',
            name: 'Registration Fee',
            price: '15',
            currency: 'USD',
            usdPrice: null,
            idrPrice: null,
            allowedCategories: [],
        });
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);
        mockPrisma.applicationInvoice.create.mockResolvedValue({ id: 'invoice-1' });

        await handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-1', 'program-1'));

        expect(mockPrisma.applicationInvoice.create).toHaveBeenCalledWith({
            data: {
                applicationId: 'app-1',
                pricingTierId: 'tier-1',
                amount: 15,
                currency: 'USD',
                amountUsd: null,
                amountIdr: null,
                status: 'unpaid',
                exchangeRateSnapshot: 17580,
            },
            select: { id: true },
        });
    });

    it('snapshots both USD and IDR prices when tier has dual pricing', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            programId: 'program-1',
            applicationCategory: 'self_funded',
            program: {
                usdInIdr: '16000',
            },
        });
        mockPrisma.programPricingTier.findFirst.mockResolvedValue({
            id: 'tier-1',
            name: 'Registration Fee',
            // Legacy fields still populated for backward compat — must be ignored
            // when the dual-pricing usdPrice/idrPrice are present.
            price: '99999',
            currency: 'IDR',
            usdPrice: '15',
            idrPrice: '240000',
            allowedCategories: [],
        });
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);
        mockPrisma.applicationInvoice.create.mockResolvedValue({ id: 'invoice-1' });

        await handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-1', 'program-1'));

        expect(mockPrisma.applicationInvoice.create).toHaveBeenCalledWith({
            data: {
                applicationId: 'app-1',
                pricingTierId: 'tier-1',
                amount: 15,
                currency: 'USD',
                amountUsd: 15,
                amountIdr: 240000,
                status: 'unpaid',
                exchangeRateSnapshot: 16000,
            },
            select: { id: true },
        });
    });

    // M59/M48: this handler is findFirst-then-create with no lock, so two
    // concurrent clicks/tabs both pass the findFirst above and both reach
    // create(). Without the partial unique index + this catch, the LOSER's
    // create() would throw P2002 straight out of execute() as an unhandled
    // 500 (or, before the index existed at all, would have silently minted a
    // second 'unpaid' invoice for the same tier). This test pins the fix: a
    // P2002 on the (application_id, pricing_tier_id) constraint must be
    // swallowed and resolved to the winner's invoice instead of propagating.
    it('resolves to the winner\'s invoice when create() loses the unique-index race (P2002)', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            programId: 'program-1',
            applicationCategory: 'self_funded',
            program: { usdInIdr: '17580' },
        });
        mockPrisma.programPricingTier.findFirst.mockResolvedValue({
            id: 'tier-1',
            name: 'Registration Fee',
            price: '15',
            currency: 'USD',
            usdPrice: null,
            idrPrice: null,
            allowedCategories: [],
        });
        // Pre-create findFirst (the TOCTOU read) sees nothing — this request
        // is genuinely racing another, not just re-reading a row that was
        // already there.
        mockPrisma.applicationInvoice.findFirst
            .mockResolvedValueOnce(null)
            // Post-P2002 re-read: the concurrent request's row won the race.
            .mockResolvedValueOnce({ id: 'invoice-winner' });
        mockPrisma.applicationInvoice.create.mockRejectedValue(makeDuplicateTierInvoiceP2002());

        const result = await handler.execute(
            new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-1', 'program-1'),
        );

        expect(result).toEqual({
            invoice_id: 'invoice-winner',
            source: 'existing',
            message: 'Invoice is ready',
        });
    });

    it('re-throws a P2002 on an unrelated constraint instead of masking it as "existing"', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        mockPrisma.participantApplication.findFirst.mockResolvedValue({
            id: 'app-1',
            programId: 'program-1',
            applicationCategory: 'self_funded',
            program: { usdInIdr: '17580' },
        });
        mockPrisma.programPricingTier.findFirst.mockResolvedValue({
            id: 'tier-1',
            name: 'Registration Fee',
            price: '15',
            currency: 'USD',
            usdPrice: null,
            idrPrice: null,
            allowedCategories: [],
        });
        mockPrisma.applicationInvoice.findFirst.mockResolvedValueOnce(null);
        const unrelatedConflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
            meta: {
                driverAdapterError: { cause: { constraint: { fields: ['external_transaction_id'] } } },
            } as unknown as Record<string, unknown>,
        });
        mockPrisma.applicationInvoice.create.mockRejectedValue(unrelatedConflict);

        await expect(
            handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-1', 'program-1')),
        ).rejects.toBe(unrelatedConflict);
    });

    // MEYS/CYS 2026: the Fully Funded fee kept being invoiced after Fully
    // Funded registration closed, because nothing here read the tier windows.
    describe('registration window and category', () => {
        const lapsed = [{ startDate: new Date('2020-01-01T00:00:00Z'), endDate: new Date('2020-02-01T00:00:00Z') }];
        const running = [{ startDate: new Date('2020-01-01T00:00:00Z'), endDate: new Date('2099-12-31T00:00:00Z') }];
        const upcoming = [{ startDate: new Date('2099-01-01T00:00:00Z'), endDate: new Date('2099-12-31T00:00:00Z') }];

        const ffTier = (validityPeriods: typeof lapsed) => ({
            id: 'tier-ff',
            name: 'Fully Funded Registration',
            price: '10',
            currency: 'USD',
            usdPrice: '10',
            idrPrice: null,
            feeType: 'registration_fee',
            allowedCategories: ['fully_funded'],
            validityPeriods,
        });

        const arrange = (category: string, ffPeriods: typeof lapsed, sfPeriods: typeof lapsed = running) => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({ id: 'participant-1', userId: 'user-1' });
            mockPrisma.participantApplication.findFirst.mockResolvedValue({
                id: 'app-1',
                programId: 'program-1',
                applicationCategory: category,
                program: {
                    usdInIdr: '16000',
                    pricingTiers: [
                        { allowedCategories: ['fully_funded'], validityPeriods: ffPeriods },
                        { allowedCategories: ['self_funded'], validityPeriods: sfPeriods },
                    ],
                },
            });
            mockPrisma.programPricingTier.findFirst.mockResolvedValue(ffTier(ffPeriods));
            mockPrisma.applicationInvoice.create.mockResolvedValue({ id: 'invoice-new' });
        };

        const rejectionOf = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e);

        it('refuses a NEW Fully Funded registration invoice once that window has closed', async () => {
            arrange('fully_funded', lapsed);
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);

            const error = await rejectionOf(handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-ff', 'program-1')));

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as BadRequestException).getResponse()).toMatchObject({ errorCode: 'REGISTRATION_WINDOW_CLOSED' });
            expect(mockPrisma.applicationInvoice.create).not.toHaveBeenCalled();
        });

        it('refuses with REGISTRATION_WINDOW_NOT_OPEN before the window opens', async () => {
            arrange('fully_funded', upcoming);
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);

            const error = await rejectionOf(handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-ff', 'program-1')));

            expect((error as BadRequestException).getResponse()).toMatchObject({ errorCode: 'REGISTRATION_WINDOW_NOT_OPEN' });
            expect(mockPrisma.applicationInvoice.create).not.toHaveBeenCalled();
        });

        it('still returns an existing paid/processing registration invoice after the window closed', async () => {
            arrange('fully_funded', lapsed);
            mockPrisma.applicationInvoice.findFirst.mockResolvedValueOnce({ id: 'invoice-paid' });

            const result = await handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-ff', 'program-1'));

            expect(result).toMatchObject({ invoice_id: 'invoice-paid', source: 'existing' });
        });

        it('still returns an existing invoice for the tier (detail pages resolve through here)', async () => {
            arrange('fully_funded', lapsed);
            mockPrisma.applicationInvoice.findFirst
                .mockResolvedValueOnce(null) // no paid/processing registration fee
                .mockResolvedValueOnce({ id: 'invoice-unpaid' });

            const result = await handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-ff', 'program-1'));

            expect(result).toMatchObject({ invoice_id: 'invoice-unpaid', source: 'existing' });
            expect(mockPrisma.applicationInvoice.create).not.toHaveBeenCalled();
        });

        it('creates the invoice while the window is open', async () => {
            arrange('fully_funded', running);
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);

            const result = await handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-ff', 'program-1'));

            expect(result).toMatchObject({ invoice_id: 'invoice-new', source: 'created' });
        });

        it('403s a Self Funded participant requesting the Fully Funded registration tier', async () => {
            arrange('self_funded', running);
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);

            const error = await rejectionOf(handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-ff', 'program-1')));

            expect(error).toBeInstanceOf(ForbiddenException);
            expect((error as ForbiddenException).getResponse()).toMatchObject({ errorCode: 'REGISTRATION_FEE_CATEGORY_MISMATCH' });
            expect(mockPrisma.applicationInvoice.findFirst).not.toHaveBeenCalled();
        });

        it('keeps the June 2026 rule: a category with no registration tier may pay another category\'s', async () => {
            arrange('self_funded', running);
            // No Self Funded tier at all this time.
            mockPrisma.participantApplication.findFirst.mockResolvedValue({
                id: 'app-1',
                programId: 'program-1',
                applicationCategory: 'self_funded',
                program: { usdInIdr: '16000', pricingTiers: [{ allowedCategories: ['fully_funded'], validityPeriods: running }] },
            });
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);

            const result = await handler.execute(new EnsurePortalPaymentInvoiceCommand('user-1', 'tier-ff', 'program-1'));

            expect(result).toMatchObject({ source: 'created' });
        });
    });
});
