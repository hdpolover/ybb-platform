// src/modules/stats/revenue/revenue.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PaymentStatus } from '@prisma/client';
import { RevenueService } from './revenue.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ExcelService } from '@shared/infrastructure/excel/excel.service';
import { RevenueAccessScope } from './utils/revenue-access.util';

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    applicationId: 'app-1',
    amount: new Prisma.Decimal('1000000'),
    currency: 'IDR',
    status: PaymentStatus.paid,
    amountUsd: null,
    amountIdr: new Prisma.Decimal('1000000'),
    exchangeRateSnapshot: null,
    feeProvider: new Prisma.Decimal('20000'),
    netAmount: new Prisma.Decimal('980000'),
    paymentMethod: 'bank_transfer',
    paidAt: new Date(),
    createdAt: new Date(),
    externalTransactionId: 'ext-1',
    pricingTier: { id: 'tier-1', name: 'Regular' },
    application: {
      programId: 'program-1',
      applicationCategory: 'self_funded',
      personalData: {},
      program: {
        id: 'program-1',
        name: 'Program One',
        brandId: 'brand-1',
        usdInIdr: null,
        brand: { id: 'brand-1', name: 'Brand One' },
      },
      participant: {
        fullName: 'Jane Doe',
        originCountry: null,
        nationality: null,
        institution: null,
        occupation: null,
      },
    },
    ...overrides,
  };
}

describe('RevenueService', () => {
  let service: RevenueService;
  const mockPrisma = {
    applicationInvoice: { findMany: jest.fn(), count: jest.fn() },
    program: { findUnique: jest.fn() },
  };
  const mockExcelService = { streamExcelRows: jest.fn() };

  const platformScope: RevenueAccessScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueService,
        { provide: PrismaReadService, useValue: mockPrisma },
        { provide: ExcelService, useValue: mockExcelService },
      ],
    }).compile();

    service = module.get<RevenueService>(RevenueService);
    jest.clearAllMocks();
  });

  describe('getProgramRevenueSummary', () => {
    it('computes collectionRate as paid / (paid + unpaid + failed), excluding processing/cancelled/refunded', async () => {
      mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1', brandId: 'brand-1', name: 'Program One', deletedAt: null });
      mockPrisma.applicationInvoice.findMany.mockResolvedValue([
        invoiceRow({ id: 'p1', status: PaymentStatus.paid }),
        invoiceRow({ id: 'p2', status: PaymentStatus.paid }),
        invoiceRow({ id: 'u1', status: PaymentStatus.unpaid }),
        invoiceRow({ id: 'f1', status: PaymentStatus.failed }),
        invoiceRow({ id: 'proc1', status: PaymentStatus.processing }),
        invoiceRow({ id: 'c1', status: PaymentStatus.cancelled }),
      ]);

      const result = await service.getProgramRevenueSummary('program-1', platformScope);

      // 2 paid / (2 paid + 1 unpaid + 1 failed) = 50%
      expect(result.kpis.collectionRate).toBe(50);
      expect(result.kpis.paidCount).toBe(2);
      expect(result.kpis.processingCount).toBe(1);
      expect(result.kpis.cancelledCount).toBe(1);
    });

    it('counts unbackfilledCount only for paid invoices missing feeProvider/netAmount, and treats their net as gross', async () => {
      mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1', brandId: 'brand-1', name: 'Program One', deletedAt: null });
      mockPrisma.applicationInvoice.findMany.mockResolvedValue([
        invoiceRow({ id: 'backfilled', status: PaymentStatus.paid, feeProvider: new Prisma.Decimal('10000'), netAmount: new Prisma.Decimal('990000') }),
        invoiceRow({ id: 'unbackfilled', status: PaymentStatus.paid, feeProvider: null, netAmount: null, amountIdr: new Prisma.Decimal('500000'), amount: new Prisma.Decimal('500000') }),
      ]);

      const result = await service.getProgramRevenueSummary('program-1', platformScope);

      expect(result.kpis.unbackfilledCount).toBe(1);
      // gross = 1,000,000 + 500,000 ; fee = 10,000 + 0 ; net = 990,000 + 500,000 (unbackfilled net falls back to its own gross)
      expect(result.kpis.grossIdr).toBe(1500000);
      expect(result.kpis.feeIdr).toBe(10000);
      expect(result.kpis.netIdr).toBe(1490000);
    });

    it('excludes non-paid invoices from gross/fee/net but still counts them in status KPIs', async () => {
      mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1', brandId: 'brand-1', name: 'Program One', deletedAt: null });
      mockPrisma.applicationInvoice.findMany.mockResolvedValue([
        invoiceRow({ id: 'unpaid-1', status: PaymentStatus.unpaid, amountIdr: new Prisma.Decimal('999999999') }),
      ]);

      const result = await service.getProgramRevenueSummary('program-1', platformScope);

      expect(result.kpis.grossIdr).toBe(0);
      expect(result.kpis.unpaidCount).toBe(1);
    });
  });

  describe('getPlatformRevenueRollup', () => {
    it('groups paid invoices by program and by brand', async () => {
      mockPrisma.applicationInvoice.findMany.mockResolvedValue([
        invoiceRow({ id: 'a1', status: PaymentStatus.paid, application: { programId: 'program-1', program: { id: 'program-1', name: 'Program One', brandId: 'brand-1', usdInIdr: null, brand: { id: 'brand-1', name: 'Brand One' } }, participant: null } }),
        invoiceRow({ id: 'a2', status: PaymentStatus.paid, application: { programId: 'program-2', program: { id: 'program-2', name: 'Program Two', brandId: 'brand-1', usdInIdr: null, brand: { id: 'brand-1', name: 'Brand One' } }, participant: null } }),
      ]);

      const result = await service.getPlatformRevenueRollup({}, platformScope);

      expect(result.byProgram).toHaveLength(2);
      expect(result.byBrand).toHaveLength(1);
      expect(result.byBrand[0].grossIdr).toBe(2000000);
      expect(result.byBrand[0].paidCount).toBe(2);
    });
  });

  describe('getRevenueTransactions', () => {
    it('returns the pagination envelope with total/page/limit/totalPages and unbackfilled summary', async () => {
      mockPrisma.applicationInvoice.count
        .mockResolvedValueOnce(42) // total
        .mockResolvedValueOnce(3); // unbackfilledCount
      mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoiceRow()]);

      const result = await service.getRevenueTransactions({ page: 2, limit: 10 }, platformScope);

      expect(result.total).toBe(42);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.summary.unbackfilledCount).toBe(3);
      expect(result.data).toHaveLength(1);
    });

    it('restricts unbackfilledCount to paid invoices so unpaid/cancelled are not counted as missing data', async () => {
      mockPrisma.applicationInvoice.count
        .mockResolvedValueOnce(42) // total
        .mockResolvedValueOnce(0); // unbackfilled (paid-only)
      mockPrisma.applicationInvoice.findMany.mockResolvedValue([invoiceRow()]);

      await service.getRevenueTransactions({ page: 1, limit: 10 }, platformScope);

      // The 2nd count() call is the unbackfilled query; it must filter to paid
      // status AND missing fee/net, not every non-backfilled invoice.
      const unbackfilledWhere = JSON.stringify(mockPrisma.applicationInvoice.count.mock.calls[1][0]);
      expect(unbackfilledWhere).toContain('"status":"paid"');
      expect(unbackfilledWhere).toContain('feeProvider');
      expect(unbackfilledWhere).toContain('netAmount');
    });
  });

  describe('exportRevenueTransactions', () => {
    function collectExportedRows(invoices: Record<string, unknown>[]) {
      const collected: Record<string, unknown>[] = [];
      const streamExcelRows = jest.fn(
        async (_res: unknown, rows: AsyncIterable<Record<string, unknown>>) => {
          for await (const row of rows) collected.push(row);
        },
      );
      mockExcelService.streamExcelRows.mockImplementation(streamExcelRows);
      mockPrisma.applicationInvoice.findMany
        .mockResolvedValueOnce(invoices)
        .mockResolvedValue([]); // stop the cursor loop on the next page
      return collected;
    }

    it('includes Country/Institution/Occupation columns positioned after Participant and before Application Category', async () => {
      collectExportedRows([invoiceRow()]);

      await service.exportRevenueTransactions({} as never, {}, platformScope);

      const columns = mockExcelService.streamExcelRows.mock.calls[0][2] as { key: string }[];
      const keys = columns.map((c) => c.key);
      const participantIdx = keys.indexOf('participant');
      const categoryIdx = keys.indexOf('applicationCategory');
      expect(keys.slice(participantIdx + 1, categoryIdx)).toEqual(['country', 'institution', 'occupation']);
    });

    it('prefers personal_data institution/occupation/nationality over the dead participant columns', async () => {
      const collected = collectExportedRows([
        invoiceRow({
          application: {
            programId: 'program-1',
            applicationCategory: 'self_funded',
            personalData: { institution: 'MIT', occupation: 'Student', nationality: 'ID' },
            program: {
              id: 'program-1',
              name: 'Program One',
              brandId: 'brand-1',
              usdInIdr: null,
              brand: { id: 'brand-1', name: 'Brand One' },
            },
            participant: {
              fullName: 'Jane Doe',
              originCountry: null,
              nationality: null,
              institution: 'Legacy University',
              occupation: 'Legacy Job',
            },
          },
        }),
      ]);

      await service.exportRevenueTransactions({} as never, {}, platformScope);

      expect(collected[0].institution).toBe('MIT');
      expect(collected[0].occupation).toBe('Student');
      expect(collected[0].country).toBe('Indonesia');
    });

    it('falls back to the participant columns when personal_data has no institution/occupation/country', async () => {
      const collected = collectExportedRows([
        invoiceRow({
          application: {
            programId: 'program-1',
            applicationCategory: 'self_funded',
            personalData: {},
            program: {
              id: 'program-1',
              name: 'Program One',
              brandId: 'brand-1',
              usdInIdr: null,
              brand: { id: 'brand-1', name: 'Brand One' },
            },
            participant: {
              fullName: 'Jane Doe',
              originCountry: 'PK',
              nationality: null,
              institution: 'Legacy University',
              occupation: 'Legacy Job',
            },
          },
        }),
      ]);

      await service.exportRevenueTransactions({} as never, {}, platformScope);

      expect(collected[0].institution).toBe('Legacy University');
      expect(collected[0].occupation).toBe('Legacy Job');
      expect(collected[0].country).toBe('Pakistan');
    });

    it('renders empty institution/occupation and N/A country when neither source has a value', async () => {
      const collected = collectExportedRows([invoiceRow()]);

      await service.exportRevenueTransactions({} as never, {}, platformScope);

      expect(collected[0].institution).toBe('');
      expect(collected[0].occupation).toBe('');
      expect(collected[0].country).toBe('N/A');
    });
  });
});
