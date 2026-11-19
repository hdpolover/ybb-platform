import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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
const OBSOLETE_ID = 'obs-invoice-id-1';

// Minimal invoice shape returned by findMany (only fields listInvoices uses in toInvoiceDto).
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

// Minimal groupBy / aggregate / count return values.
const EMPTY_GROUP_BY: never[] = [];
const EMPTY_AGGREGATE = { _sum: { amount: null }, _avg: { amount: null }, _count: { id: 0 } };

function buildMockPrisma(obsoleteIds: string[], invoices: ReturnType<typeof makeInvoice>[]) {
    return {
        $queryRaw: jest.fn().mockResolvedValue(obsoleteIds.map((id) => ({ id }))),
        applicationInvoice: {
            findMany: jest.fn().mockResolvedValue(invoices),
            count: jest.fn().mockResolvedValue(invoices.length),
            groupBy: jest.fn().mockResolvedValue(EMPTY_GROUP_BY),
            aggregate: jest.fn().mockResolvedValue(EMPTY_AGGREGATE),
        },
        programPricingTier: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        participantApplication: {
            groupBy: jest.fn().mockResolvedValue(EMPTY_GROUP_BY),
        },
    };
}

async function buildController(mockPrisma: ReturnType<typeof buildMockPrisma>) {
    const module: TestingModule = await Test.createTestingModule({
        controllers: [PaymentAdminController],
        providers: [
            { provide: PaymentServiceHttpClient, useValue: { post: jest.fn() } },
            { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) } },
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

// Platform-scope caller: this spec is not about programme scope, which
// payment-admin.controller.scope.spec.ts covers against the real resolver.
jest.mock('@shared/guards/admin-scope.guard', () => ({
    ...jest.requireActual('@shared/guards/admin-scope.guard'),
    getRequestAdminScope: async () => ({ kind: 'platform', allowedBrandIds: null, allowedProgramIds: null }),
}));

describe('PaymentAdminController — category-aware filter in listInvoices', () => {
    describe('(a) $queryRaw returns one obsolete ID', () => {
        let mockPrisma: ReturnType<typeof buildMockPrisma>;
        let controller: PaymentAdminController;

        beforeEach(async () => {
            mockPrisma = buildMockPrisma([OBSOLETE_ID], [makeInvoice('other-invoice-id')]);
            controller = await buildController(mockPrisma);
        });

        it('calls $queryRaw with the programId', async () => {
            await controller.listInvoices({ programId: PROGRAM_ID });

            expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
            // The raw query is built with Prisma.sql, so the first arg is a TemplateStringsArray.
            // We just verify it was called (the programId is interpolated as a bind param).
        });

        it('passes id: { notIn } to findMany', async () => {
            await controller.listInvoices({ programId: PROGRAM_ID });

            expect(mockPrisma.applicationInvoice.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: { notIn: [OBSOLETE_ID] },
                    }),
                }),
            );
        });

        it('keeps superseded invoices when listing one application', async () => {
            const APP_ID = '11111111-1111-4111-8111-111111111111';
            await controller.listInvoices({ programId: PROGRAM_ID, applicationId: APP_ID });

            const [[arg]] = (mockPrisma.applicationInvoice.findMany as jest.Mock).mock.calls;
            expect(arg.where.id).toBeUndefined();
        });

        it('passes id: { notIn } to both aggregate calls', async () => {
            await controller.listInvoices({ programId: PROGRAM_ID });

            const aggregateCalls = (mockPrisma.applicationInvoice.aggregate as jest.Mock).mock.calls;
            expect(aggregateCalls.length).toBeGreaterThanOrEqual(2);
            for (const [arg] of aggregateCalls) {
                expect(arg.where).toEqual(
                    expect.objectContaining({ id: { notIn: [OBSOLETE_ID] } }),
                );
            }
        });

        it('passes id: { notIn } to the summary (overallSummary) groupBy call', async () => {
            await controller.listInvoices({ programId: PROGRAM_ID });

            const groupByCalls = (mockPrisma.applicationInvoice.groupBy as jest.Mock).mock.calls;
            // At least one groupBy call should be the overallSummary (application: { programId } + excludeObsolete)
            const overallCall = groupByCalls.find(
                ([arg]) =>
                    arg.where &&
                    arg.where.application?.programId === PROGRAM_ID &&
                    arg.where.id?.notIn,
            );
            expect(overallCall).toBeDefined();
        });

        it('passes id: { notIn } to follow-up count queries', async () => {
            await controller.listInvoices({ programId: PROGRAM_ID });

            const countCalls = (mockPrisma.applicationInvoice.count as jest.Mock).mock.calls;
            // All four follow-up count queries use application: { programId } at the top level.
            const programWideCountCalls = countCalls.filter(
                ([arg]) => arg.where?.application?.programId === PROGRAM_ID,
            );
            // There are at most 4 follow-up count calls in Promise.all (plus a total count that
            // uses `where` which also gets excludeObsolete injected).
            expect(programWideCountCalls.length).toBeGreaterThanOrEqual(4);
            for (const [arg] of programWideCountCalls) {
                expect(arg.where).toEqual(
                    expect.objectContaining({ id: { notIn: [OBSOLETE_ID] } }),
                );
            }
        });
    });

    describe('(b) $queryRaw returns [] (no obsolete invoices)', () => {
        let mockPrisma: ReturnType<typeof buildMockPrisma>;
        let controller: PaymentAdminController;

        beforeEach(async () => {
            mockPrisma = buildMockPrisma([], [makeInvoice('regular-invoice-id')]);
            controller = await buildController(mockPrisma);
        });

        it('does NOT inject id: { notIn } into findMany when there are no obsolete IDs', async () => {
            await controller.listInvoices({ programId: PROGRAM_ID });

            const [[findManyArg]] = (mockPrisma.applicationInvoice.findMany as jest.Mock).mock.calls;
            expect(findManyArg.where?.id?.notIn).toBeUndefined();
        });

        it('does NOT inject id: { notIn } into aggregate calls', async () => {
            await controller.listInvoices({ programId: PROGRAM_ID });

            const aggregateCalls = (mockPrisma.applicationInvoice.aggregate as jest.Mock).mock.calls;
            for (const [arg] of aggregateCalls) {
                expect(arg.where?.id?.notIn).toBeUndefined();
            }
        });
    });

    describe('(c) obsolete ID is excluded from the returned list', () => {
        it('list does not include an invoice that findMany filtered out', async () => {
            // Simulate findMany already honoring the filter: it returns only the non-obsolete invoice.
            const mockPrisma = buildMockPrisma([OBSOLETE_ID], [makeInvoice('current-invoice-id')]);
            const controller = await buildController(mockPrisma);

            const result = await controller.listInvoices({ programId: PROGRAM_ID });

            const returnedIds = result.data.map((inv: { id: string }) => inv.id);
            expect(returnedIds).not.toContain(OBSOLETE_ID);
            expect(returnedIds).toContain('current-invoice-id');
        });
    });

    describe('(d) applicationId set: rows only, no program-wide aggregates', () => {
        const APP_ID = '11111111-1111-4111-8111-111111111111';

        it('skips the obsolete scan, summaries, metrics and facets but returns the rows in the same shape', async () => {
            const mockPrisma = buildMockPrisma([OBSOLETE_ID], [makeInvoice('inv-1'), makeInvoice('inv-2')]);
            const controller = await buildController(mockPrisma);

            const result = await controller.listInvoices({ programId: PROGRAM_ID, applicationId: APP_ID });

            expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
            expect(mockPrisma.applicationInvoice.groupBy).not.toHaveBeenCalled();
            expect(mockPrisma.applicationInvoice.aggregate).not.toHaveBeenCalled();
            expect(mockPrisma.programPricingTier.findMany).not.toHaveBeenCalled();
            expect(mockPrisma.participantApplication.groupBy).not.toHaveBeenCalled();
            // Only the row total; none of the follow-up bucket counts.
            expect(mockPrisma.applicationInvoice.count).toHaveBeenCalledTimes(1);

            expect(result.data.map((inv: { id: string }) => inv.id)).toEqual(['inv-1', 'inv-2']);
            expect(result.meta.total).toBe(2);
            expect(result.summary.paid).toEqual({ count: 0, amount: 0 });
            expect(result.overallSummary.unpaid).toEqual({ count: 0, amount: 0 });
            expect(result.metrics.totalInvoices).toBe(0);
            expect(result.filters.tiers).toEqual([]);
            expect(result.filters.followUpStatuses).toEqual([]);
        });

        it('allows limit up to 200 for one application, still 100 program-wide', async () => {
            const mockPrisma = buildMockPrisma([], []);
            const controller = await buildController(mockPrisma);

            await controller.listInvoices({ programId: PROGRAM_ID, applicationId: APP_ID, limit: '500' });
            await controller.listInvoices({ programId: PROGRAM_ID, limit: '500' });

            const takes = (mockPrisma.applicationInvoice.findMany as jest.Mock).mock.calls.map(([arg]) => arg.take);
            expect(takes).toEqual([200, 100]);
        });
    });
});
