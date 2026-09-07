// src/modules/payments/presentation/__tests__/payment-admin.controller.payments-by-country.spec.ts
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

// Mirrors what the raw SQL query in buildPaymentsByCountry would return: it is
// grouped by (country, currency), status = paid, deleted applications already
// excluded by the WHERE clause (not something the controller code re-checks
// in JS), so the mock only needs to stand in for the query result shape.
function mockQueryRaw(rows: { country: string | null; currency: string; count: bigint; amount: number }[]) {
    return jest.fn().mockResolvedValue(rows);
}

async function buildController(queryRaw: jest.Mock) {
    const mockPrisma = { $queryRaw: queryRaw };
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

describe('PaymentAdminController — getPaymentsByCountry', () => {
    it('groups, humanizes ISO-2 codes, merges duplicates, and ranks by paid count descending', async () => {
        const queryRaw = mockQueryRaw([
            { country: 'Indonesia', currency: 'IDR', count: 3n, amount: 3000000 },
            { country: 'ID', currency: 'IDR', count: 2n, amount: 2000000 }, // same country, different raw text
            { country: 'US', currency: 'USD', count: 10n, amount: 500 },
        ]);
        const controller = await buildController(queryRaw);

        const result = await controller.getPaymentsByCountry(PROGRAM_ID);

        expect(result.data[0]).toEqual({
            country: 'United States',
            paidCount: 10,
            amounts: [{ currency: 'USD', amount: 500 }],
        });
        expect(result.data[1]).toEqual({
            country: 'Indonesia',
            paidCount: 5, // 3 + 2 merged after humanizing "ID" -> "Indonesia"
            amounts: [{ currency: 'IDR', amount: 5000000 }],
        });
        expect(result.totalPaidCount).toBe(15);
    });

    it('buckets rows with no attributable country under an explicit Unknown bucket instead of dropping them', async () => {
        const queryRaw = mockQueryRaw([
            { country: null, currency: 'IDR', count: 4n, amount: 4000000 },
            { country: 'Indonesia', currency: 'IDR', count: 1n, amount: 1000000 },
        ]);
        const controller = await buildController(queryRaw);

        const result = await controller.getPaymentsByCountry(PROGRAM_ID);

        const unknown = result.data.find((row) => row.country === 'Unknown');
        expect(unknown).toEqual({ country: 'Unknown', paidCount: 4, amounts: [{ currency: 'IDR', amount: 4000000 }] });
        expect(result.unknownCount).toBe(4);
        // Totals must reconcile: unknown rows are counted, not dropped.
        expect(result.totalPaidCount).toBe(5);
    });

    it('excludes unpaid invoices by filtering status = paid in the query, not counting them client-side', async () => {
        // The controller trusts the SQL WHERE clause to exclude non-paid invoices;
        // this asserts the query passed to $queryRaw actually filters on paid status.
        const queryRaw = mockQueryRaw([]);
        const controller = await buildController(queryRaw);

        await controller.getPaymentsByCountry(PROGRAM_ID);

        const [sqlFragment] = queryRaw.mock.calls[0];
        const sqlText = sqlFragment.strings ? sqlFragment.strings.join('') : String(sqlFragment);
        expect(sqlText).toContain('ai.status');
        expect(sqlFragment.values ?? []).toEqual(expect.arrayContaining(['paid']));
    });

    it('rejects a missing programId with 400', async () => {
        const controller = await buildController(mockQueryRaw([]));
        await expect(controller.getPaymentsByCountry('')).rejects.toThrow(HttpException);
    });
});
