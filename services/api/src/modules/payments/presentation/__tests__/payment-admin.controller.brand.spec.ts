import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

const MOCK_ADMIN_USER: CurrentUserData = {
    userId: 'admin-1',
    email: 'admin@test.com',
    brandId: 'brand-1',
    role: [],
    adminId: 'admin-id-1',
};

const MOCK_BRAND = {
    id: 'brand-1',
    name: 'Test Brand',
    primaryColor: '#FF5500',
    logoUrl: 'https://example.com/logo.png',
    websiteUrl: 'https://example.com',
    landingUrl: 'https://example.com',
    contactEmail: 'info@example.com',
    contactAddress: '123 Test St',
    socialMediaLinks: {},
    settings: {
        footerNavigation: [],
        supportEmail: 'support@example.com',
    },
};

const MOCK_INVOICE = {
    id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
    amount: 500000,
    currency: 'IDR',
    applicationId: 'app-1',
    externalTransactionId: 'txn-1',
    pricingTier: { feeType: 'program_fee' },
    application: {
        id: 'app-1',
        participant: {
            fullName: 'John Doe',
            userId: 'user-1',
            user: { email: 'john@example.com' },
        },
        program: {
            brand: MOCK_BRAND,
        },
    },
};

describe('PaymentAdminController — payment.rejected brand emission', () => {
    let controller: PaymentAdminController;
    let rabbitmqProducer: jest.Mocked<RabbitMQProducerService>;
    let prisma: jest.Mocked<PrismaService>;
    let cacheService: jest.Mocked<CacheService>;
    let paymentServiceClient: jest.Mocked<PaymentServiceHttpClient>;

    beforeEach(async () => {
        const mockRabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };
        const mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(MOCK_INVOICE),
                update: jest.fn().mockResolvedValue(MOCK_INVOICE),
            },
            participantApplication: {
                update: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
        };
        const mockCache = {
            invalidateInvoiceCache: jest.fn().mockResolvedValue(undefined),
        };
        const mockPaymentClient = {
            post: jest.fn().mockResolvedValue({ data: { success: true } }),
        };
        const mockConfig = { get: jest.fn().mockReturnValue('') };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: ConfigService, useValue: mockConfig },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: mockCache },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: RabbitMQProducerService, useValue: mockRabbitmq },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<PaymentAdminController>(PaymentAdminController);
        rabbitmqProducer = module.get(RabbitMQProducerService);
        prisma = module.get(PrismaService);
        cacheService = module.get(CacheService);
        paymentServiceClient = module.get(PaymentServiceHttpClient);
    });

    it('should include brand payload in payment.rejected emit', async () => {
        await controller.verifyInvoice('a1b2c3d4-e5f6-4890-abcd-ef1234567890', { action: 'reject', reason: 'Invalid docs' }, MOCK_ADMIN_USER);

        expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
            'payment.rejected',
            expect.objectContaining({
                brand: expect.objectContaining({
                    name: 'Test Brand',
                    primaryColor: '#FF5500',
                    logoUrl: 'https://example.com/logo.png',
                    settings: expect.objectContaining({
                        supportEmail: 'support@example.com',
                    }),
                }),
            }),
        );
    });

    it('should emit null brand when no brand is associated', async () => {
        (prisma.applicationInvoice.findUnique as jest.Mock).mockResolvedValue({
            ...MOCK_INVOICE,
            application: {
                ...MOCK_INVOICE.application,
                program: { brand: null },
            },
        });

        await controller.verifyInvoice('a1b2c3d4-e5f6-4890-abcd-ef1234567890', { action: 'reject', reason: 'Test' }, MOCK_ADMIN_USER);

        expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
            'payment.rejected',
            expect.objectContaining({ brand: null }),
        );
    });
});
