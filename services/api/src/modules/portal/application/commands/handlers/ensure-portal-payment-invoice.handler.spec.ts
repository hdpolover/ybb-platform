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

    it('stores the program exchange-rate snapshot on newly created USD invoices', async () => {
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
                brand: {
                    settings: {
                        usdInIdr: '16000',
                    },
                },
            },
        });
        mockPrisma.programPricingTier.findFirst.mockResolvedValue({
            id: 'tier-1',
            name: 'Registration Fee',
            price: '15',
            currency: 'USD',
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
                status: 'unpaid',
                exchangeRateSnapshot: 17580,
            },
            select: { id: true },
        });
    });
});
