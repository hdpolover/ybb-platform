import { Test, TestingModule } from '@nestjs/testing';
import { EnsurePortalPaymentInvoiceHandler } from './ensure-portal-payment-invoice.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { EnsurePortalPaymentInvoiceCommand } from '../../queries/portal-queries';

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
});
