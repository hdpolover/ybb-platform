// src/modules/payments/presentation/__tests__/payment-admin.controller.list-export-parity.spec.ts
//
// Regression coverage for the list/export drift bug: the payments Excel
// export used to build its `where` clause independently of
// PaymentAdminController.listInvoices, so filtering the table down to a
// handful of rows and clicking Export silently produced the full unfiltered
// dataset. Both endpoints now go through the shared buildInvoiceWhere()
// (invoice-where.builder.ts) — this spec proves that sharing holds, both in
// isolation and end-to-end through the two real call paths.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
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
import { ReportingService } from '../../../reporting/reporting.service';
import { buildInvoiceWhere } from '../../application/services/invoice-where.builder';

const PROGRAM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TIER_ID = 'tier-123';
const OBSOLETE_ID = 'obsolete-invoice-1';

const AMBASSADOR_MATCH = { user: { ambassador: { isNot: null } } };

// A filter set that exercises the three params the export endpoint used to
// silently drop: payerType, tierId, and dateFrom.
const SHARED_FILTERS = {
    payerType: 'ambassador',
    tierId: TIER_ID,
    dateFrom: '2024-01-01',
};

function makeInvoice(id: string) {
    return {
        id,
        status: 'unpaid',
        amount: 1000000,
        currency: 'IDR',
        applicationId: 'app-1',
        externalTransactionId: null,
        externalIntentId: null,
        pricingTierId: TIER_ID,
        paymentMethod: null,
        rejectionReason: null,
        verifiedBy: null,
        paidAt: null,
        personalData: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        pricingTier: { id: TIER_ID, name: 'Tier 1', feeType: 'registration_fee', usdPrice: null, idrPrice: null },
        application: {
            id: 'app-1',
            personalData: null,
            program: { name: 'Test Program' },
            participant: {
                fullName: 'Test User',
                userId: 'user-1',
                phoneCountryCode: null,
                phoneNumber: null,
                nationality: null,
                user: { id: 'user-1', email: 'test@example.com', ambassador: { id: 'amb-1', referralCode: 'X', isActive: true, programId: PROGRAM_ID } },
            },
        },
    };
}

const EMPTY_GROUP_BY: never[] = [];
const EMPTY_AGGREGATE = { _sum: { amount: null }, _avg: { amount: null }, _count: { id: 0 } };

function buildMockPrisma(obsoleteIds: string[] = []) {
    return {
        $queryRaw: jest.fn().mockResolvedValue(obsoleteIds.map((id) => ({ id }))),
        applicationInvoice: {
            // First call (the list's single findMany, or the export
            // generator's first page) returns one row; every call after
            // that returns empty so the export's `while (true)` cursor
            // loop terminates instead of looping forever on a mock that
            // always resolves the same non-empty page.
            findMany: jest.fn()
                .mockResolvedValueOnce([makeInvoice('inv-1')])
                .mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(1),
            groupBy: jest.fn().mockResolvedValue(EMPTY_GROUP_BY),
            aggregate: jest.fn().mockResolvedValue(EMPTY_AGGREGATE),
        },
        programPricingTier: { findMany: jest.fn().mockResolvedValue([]) },
        participantApplication: { groupBy: jest.fn().mockResolvedValue(EMPTY_GROUP_BY) },
    };
}

async function buildListController(mockPrisma: ReturnType<typeof buildMockPrisma>) {
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

// Drains the export's async-generator row stream without touching the real
// ExcelJS writer — findMany is mocked to return one invoice on the first
// call and an empty array afterwards, so the generator terminates on its
// own after a single page.
function buildFakeExcelService() {
    return {
        streamExcelRows: jest.fn(async (_res: unknown, rows: AsyncIterable<unknown>) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _row of rows) {
                // drain
            }
        }),
    };
}

function buildExportService(mockPrisma: ReturnType<typeof buildMockPrisma>) {
    const excelService = buildFakeExcelService();
    const service = new ReportingService(
        mockPrisma as unknown as PrismaService,
        mockPrisma as unknown as PrismaReadService,
        excelService as never,
    );
    return { service, excelService };
}

const FAKE_RES = { setHeader: jest.fn(), end: jest.fn() } as unknown as Response;

describe('Payments list/export where-clause parity', () => {
    it('buildInvoiceWhere is deep-equal for the same filter set regardless of caller', () => {
        const fromList = buildInvoiceWhere({ programId: PROGRAM_ID, ...SHARED_FILTERS }, []);
        const fromExport = buildInvoiceWhere({ programId: PROGRAM_ID, ...SHARED_FILTERS }, []);

        expect(fromExport).toEqual(fromList);
        expect(fromList.application).toEqual(expect.objectContaining({ programId: PROGRAM_ID, participant: AMBASSADOR_MATCH }));
        expect(fromList.pricingTierId).toBe(TIER_ID);
        expect(fromList.createdAt).toEqual({ gte: new Date('2024-01-01') });
    });

    it('folds the obsolete-invoice exclusion identically for both callers', () => {
        const fromList = buildInvoiceWhere({ programId: PROGRAM_ID, ...SHARED_FILTERS }, [OBSOLETE_ID]);
        const fromExport = buildInvoiceWhere({ programId: PROGRAM_ID, ...SHARED_FILTERS }, [OBSOLETE_ID]);

        expect(fromExport).toEqual(fromList);
        expect((fromList as { id?: { notIn: string[] } }).id).toEqual({ notIn: [OBSOLETE_ID] });
    });

    it('listInvoices and exportPayments query Prisma with the identical where clause for the same filters', async () => {
        const listPrisma = buildMockPrisma();
        const exportPrisma = buildMockPrisma();

        const controller = await buildListController(listPrisma);
        const { service: reportingService } = buildExportService(exportPrisma);

        await controller.listInvoices({ programId: PROGRAM_ID, ...SHARED_FILTERS });
        await reportingService.exportPayments(FAKE_RES, { programId: PROGRAM_ID, ...SHARED_FILTERS });

        const listWhere = (listPrisma.applicationInvoice.findMany.mock.calls[0][0] as { where: unknown }).where;
        const exportWhere = (exportPrisma.applicationInvoice.findMany.mock.calls[0][0] as { where: unknown }).where;

        expect(exportWhere).toEqual(listWhere);
    });

    it('honors payerType, tierId, and dateFrom in the export path — the params the drifted export used to silently drop', async () => {
        const exportPrisma = buildMockPrisma();
        const { service: reportingService } = buildExportService(exportPrisma);

        await reportingService.exportPayments(FAKE_RES, { programId: PROGRAM_ID, ...SHARED_FILTERS });

        const exportWhere = exportPrisma.applicationInvoice.findMany.mock.calls[0][0] as {
            where: {
                application: { programId: string; participant?: unknown };
                pricingTierId?: string;
                createdAt?: { gte?: Date };
            };
        };

        expect(exportWhere.where.application).toEqual(
            expect.objectContaining({ programId: PROGRAM_ID, participant: AMBASSADOR_MATCH }),
        );
        expect(exportWhere.where.pricingTierId).toBe(TIER_ID);
        expect(exportWhere.where.createdAt).toEqual({ gte: new Date('2024-01-01') });
    });

    it('an unfiltered export still excludes obsolete registration-fee invoices, same as the list', async () => {
        const exportPrisma = buildMockPrisma([OBSOLETE_ID]);
        const { service: reportingService } = buildExportService(exportPrisma);

        await reportingService.exportPayments(FAKE_RES, { programId: PROGRAM_ID });

        expect(exportPrisma.$queryRaw).toHaveBeenCalled();
        const exportWhere = exportPrisma.applicationInvoice.findMany.mock.calls[0][0] as {
            where: { id?: { notIn: string[] } };
        };
        expect(exportWhere.where.id).toEqual({ notIn: [OBSOLETE_ID] });
    });

    it('does not run the obsolete-invoice pre-query when the export has no programId', async () => {
        const exportPrisma = buildMockPrisma();
        const { service: reportingService } = buildExportService(exportPrisma);

        await reportingService.exportPayments(FAKE_RES, {});

        expect(exportPrisma.$queryRaw).not.toHaveBeenCalled();
    });
});
