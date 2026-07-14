// src/modules/payments/presentation/__tests__/payment-admin.controller.payer-type-filter.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';

const PROGRAM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const AMBASSADOR_MATCH = { user: { ambassador: { isNot: null } } };
const PARTICIPANT_MATCH = { user: { ambassador: { is: null } } };

function makeInvoice(id: string) {
    return {
        id,
        status: 'unpaid',
        amount: 1000000,
        currency: 'IDR',
        applicationId: 'app-1',
        externalTransactionId: null,
        externalIntentId: null,
        pricingTierId: 'tier-1',
        paymentMethod: null,
        rejectionReason: null,
        verifiedBy: null,
        paidAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        pricingTier: { id: 'tier-1', name: 'Tier 1', feeType: 'registration_fee', usdPrice: null, idrPrice: null },
        application: {
            id: 'app-1',
            participant: {
                fullName: 'Test User',
                userId: 'user-1',
                user: { id: 'user-1', email: 'test@example.com', ambassador: null },
            },
        },
    };
}

const EMPTY_GROUP_BY: never[] = [];
const EMPTY_AGGREGATE = { _sum: { amount: null }, _avg: { amount: null }, _count: { id: 0 } };

function buildMockPrisma() {
    return {
        $queryRaw: jest.fn().mockResolvedValue([]),
        applicationInvoice: {
            findMany: jest.fn().mockResolvedValue([makeInvoice('inv-1')]),
            count: jest.fn().mockResolvedValue(1),
            groupBy: jest.fn().mockResolvedValue(EMPTY_GROUP_BY),
            aggregate: jest.fn().mockResolvedValue(EMPTY_AGGREGATE),
        },
        programPricingTier: { findMany: jest.fn().mockResolvedValue([]) },
        participantApplication: { groupBy: jest.fn().mockResolvedValue(EMPTY_GROUP_BY) },
    };
}

async function buildController(mockPrisma: ReturnType<typeof buildMockPrisma>) {
    const module: TestingModule = await Test.createTestingModule({
        controllers: [PaymentAdminController],
        providers: [
            { provide: PaymentServiceHttpClient, useValue: { post: jest.fn() } },
            { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn() } },
            { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
            { provide: FileServiceClient, useValue: {} },
            { provide: CacheService, useValue: { invalidateInvoiceCache: jest.fn() } },
            { provide: PrismaService, useValue: mockPrisma },
            { provide: PrismaReadService, useValue: mockPrisma },
            { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
        ],
    })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

    return module.get<PaymentAdminController>(PaymentAdminController);
}

describe('PaymentAdminController — payerType filter in listInvoices', () => {
    let mockPrisma: ReturnType<typeof buildMockPrisma>;
    let controller: PaymentAdminController;

    beforeEach(async () => {
        mockPrisma = buildMockPrisma();
        controller = await buildController(mockPrisma);
    });

    function findManyWhere() {
        const [[arg]] = (mockPrisma.applicationInvoice.findMany as jest.Mock).mock.calls;
        return arg.where;
    }

    it('filters the list to ambassador payers when payerType=ambassador', async () => {
        await controller.listInvoices({ programId: PROGRAM_ID, payerType: 'ambassador' });

        expect(findManyWhere().application).toEqual(
            expect.objectContaining({ programId: PROGRAM_ID, participant: AMBASSADOR_MATCH }),
        );
    });

    it('filters the list to non-ambassador payers when payerType=participant', async () => {
        await controller.listInvoices({ programId: PROGRAM_ID, payerType: 'participant' });

        expect(findManyWhere().application).toEqual(
            expect.objectContaining({ programId: PROGRAM_ID, participant: PARTICIPANT_MATCH }),
        );
    });

    it('applies no payer filter when payerType=all', async () => {
        await controller.listInvoices({ programId: PROGRAM_ID, payerType: 'all' });

        expect(findManyWhere().application.participant).toBeUndefined();
    });

    it('applies no payer filter when payerType is omitted', async () => {
        await controller.listInvoices({ programId: PROGRAM_ID });

        expect(findManyWhere().application.participant).toBeUndefined();
    });

    it('rejects an unknown payerType instead of silently returning unfiltered data', async () => {
        await expect(
            controller.listInvoices({ programId: PROGRAM_ID, payerType: 'ambasador' }),
        ).rejects.toThrow(HttpException);
    });

    it('applies the payer filter to the stats aggregates, not just the list', async () => {
        await controller.listInvoices({ programId: PROGRAM_ID, payerType: 'ambassador' });

        const aggregateCalls = (mockPrisma.applicationInvoice.aggregate as jest.Mock).mock.calls;
        expect(aggregateCalls.length).toBeGreaterThanOrEqual(2);
        for (const [arg] of aggregateCalls) {
            expect(arg.where.application).toEqual(
                expect.objectContaining({ participant: AMBASSADOR_MATCH }),
            );
        }
    });

    it('applies the payer filter to the status facet counts', async () => {
        await controller.listInvoices({ programId: PROGRAM_ID, payerType: 'ambassador' });

        const groupByCalls = (mockPrisma.applicationInvoice.groupBy as jest.Mock).mock.calls;
        const statusFacetCall = groupByCalls.find(
            ([arg]) => arg.where?.application?.participant && arg.where.status === undefined,
        );
        expect(statusFacetCall).toBeDefined();
    });

    it('combines the payer filter with an existing applicationStatus filter', async () => {
        await controller.listInvoices({
            programId: PROGRAM_ID,
            payerType: 'ambassador',
            applicationStatus: 'submitted',
        });

        expect(findManyWhere().application).toEqual(
            expect.objectContaining({
                programId: PROGRAM_ID,
                status: 'submitted',
                participant: AMBASSADOR_MATCH,
            }),
        );
    });
});
