// src/modules/stats/revenue/revenue.service.ts
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { Prisma, PaymentStatus } from '@prisma/client';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ExcelService } from '@shared/infrastructure/excel/excel.service';
import {
  RevenueAccessScope,
  assertProgramAccess,
  buildInvoiceScopeWhere,
} from './utils/revenue-access.util';
import { resolveInvoiceRevenue, ResolvedInvoiceMoney } from './utils/revenue-money.util';
import { PlatformRevenueQueryDto, RevenueTransactionsQueryDto } from './dto/revenue-query.dto';
import {
  PlatformRevenueRollupResponseDto,
  ProgramRevenueSummaryResponseDto,
  RevenueByBrandItemDto,
  RevenueByMonthItemDto,
  RevenueByPaymentMethodItemDto,
  RevenueByProgramItemDto,
  RevenueByTierItemDto,
  RevenueKpisDto,
  RevenueTransactionRowDto,
  RevenueTransactionsResultDto,
} from './dto/revenue-response.dto';

const revenueInvoiceSelect = {
  id: true,
  applicationId: true,
  amount: true,
  currency: true,
  status: true,
  amountUsd: true,
  amountIdr: true,
  exchangeRateSnapshot: true,
  feeProvider: true,
  netAmount: true,
  paymentMethod: true,
  paidAt: true,
  createdAt: true,
  externalTransactionId: true,
  pricingTier: { select: { id: true, name: true } },
  application: {
    select: {
      programId: true,
      program: {
        select: {
          id: true,
          name: true,
          brandId: true,
          usdInIdr: true,
          brand: { select: { id: true, name: true } },
        },
      },
      participant: { select: { fullName: true } },
    },
  },
} satisfies Prisma.ApplicationInvoiceSelect;

type RevenueInvoiceRow = Prisma.ApplicationInvoiceGetPayload<{ select: typeof revenueInvoiceSelect }>;

interface EnrichedRow {
  status: PaymentStatus;
  paidAt: Date | null;
  paymentMethod: string | null;
  tierId: string | null;
  tierName: string | null;
  programId: string;
  programName: string;
  brandId: string | null;
  brandName: string;
  money: ResolvedInvoiceMoney;
}

const EXPORT_BATCH_SIZE = 500;
const REVENUE_BY_MONTH_WINDOW = 6; // matches getAdminProgramAnalytics's existing 6-month convention

@Injectable()
export class RevenueService {
  constructor(
    private readonly readPrisma: PrismaReadService,
    private readonly excelService: ExcelService,
  ) {}

  // ── 1. Per-program revenue summary ──────────────────────────────────────

  async getProgramRevenueSummary(
    programId: string,
    scope: RevenueAccessScope,
  ): Promise<ProgramRevenueSummaryResponseDto> {
    const program = await assertProgramAccess(this.readPrisma, scope, programId);

    const invoices = await this.readPrisma.applicationInvoice.findMany({
      where: { application: { programId: program.id } },
      select: revenueInvoiceSelect,
    });

    const rows = invoices.map((invoice) => this.enrichRow(invoice));

    return {
      kpis: this.buildKpis(rows),
      revenueByMonth: this.buildRevenueByMonth(rows),
      byPaymentMethod: this.buildByPaymentMethod(rows),
      byTier: this.buildByTier(rows),
    };
  }

  // ── 2. Platform-wide revenue rollup ─────────────────────────────────────

  async getPlatformRevenueRollup(
    query: PlatformRevenueQueryDto,
    scope: RevenueAccessScope,
  ): Promise<PlatformRevenueRollupResponseDto> {
    const where = buildInvoiceScopeWhere(scope, query.brandId);

    const invoices = await this.readPrisma.applicationInvoice.findMany({
      where,
      select: revenueInvoiceSelect,
    });

    const rows = invoices.map((invoice) => this.enrichRow(invoice));

    return {
      kpis: this.buildKpis(rows),
      revenueByMonth: this.buildRevenueByMonth(rows),
      byProgram: this.buildByProgram(rows),
      byBrand: this.buildByBrand(rows),
    };
  }

  // ── 3. Revenue audit transaction list ───────────────────────────────────

  async getRevenueTransactions(
    query: RevenueTransactionsQueryDto,
    scope: RevenueAccessScope,
  ): Promise<RevenueTransactionsResultDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildTransactionsWhere(query, scope);

    const [total, invoices, unbackfilledCount] = await Promise.all([
      this.readPrisma.applicationInvoice.count({ where }),
      this.readPrisma.applicationInvoice.findMany({
        where,
        select: revenueInvoiceSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.readPrisma.applicationInvoice.count({
        // Only paid invoices are expected to carry fee/net. Unpaid/cancelled
        // invoices legitimately have none, so counting them would falsely flag
        // the data as incomplete (mirrors buildKpis, which counts unbackfilled
        // among paid invoices only).
        where: this.buildTransactionsWhere(query, scope, [
          { status: PaymentStatus.paid },
          { OR: [{ feeProvider: null }, { netAmount: null }] },
        ]),
      }),
    ]);

    const data: RevenueTransactionRowDto[] = invoices.map((invoice) => this.toTransactionRow(invoice));

    return {
      data,
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      summary: { unbackfilledCount },
    };
  }

  // ── 4. Excel export (same filters as #3) ────────────────────────────────

  async exportRevenueTransactions(
    res: Response,
    query: RevenueTransactionsQueryDto,
    scope: RevenueAccessScope,
  ): Promise<void> {
    const columns = [
      { header: 'Invoice ID', key: 'invoiceId', width: 36 },
      { header: 'Application ID', key: 'applicationId', width: 36 },
      { header: 'Program', key: 'program', width: 30 },
      { header: 'Participant', key: 'participant', width: 30 },
      { header: 'Gross Amount', key: 'grossAmount', width: 15 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Fee (Est. IDR)', key: 'feeIdr', width: 15 },
      { header: 'Net (Est. IDR)', key: 'netIdr', width: 15 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Paid At', key: 'paidAt', width: 20 },
      { header: 'Ext Tx ID', key: 'extTxId', width: 30 },
    ];

    await this.excelService.streamExcelRows(
      res,
      this.iterateTransactionRows(query, scope),
      columns,
      'revenue-transactions',
    );
  }

  private async *iterateTransactionRows(query: RevenueTransactionsQueryDto, scope: RevenueAccessScope) {
    const where = this.buildTransactionsWhere(query, scope);
    let cursor: { id: string; createdAt: Date } | null = null;

    for (;;) {
      const cursorWhere: Prisma.ApplicationInvoiceWhereInput | undefined = cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : undefined;

      const invoices = await this.readPrisma.applicationInvoice.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        select: revenueInvoiceSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: EXPORT_BATCH_SIZE,
      });
      if (invoices.length === 0) return;

      for (const invoice of invoices) {
        const row = this.toTransactionRow(invoice);
        yield {
          invoiceId: row.invoiceId,
          applicationId: row.applicationId,
          program: row.programName,
          participant: row.participantName ?? 'N/A',
          grossAmount: row.grossAmount,
          currency: row.currency,
          feeIdr: row.feeIdr ?? '-',
          netIdr: row.netIdr ?? '-',
          method: row.paymentMethod ?? '-',
          status: row.status,
          paidAt: row.paidAt ?? '-',
          extTxId: row.externalTransactionId ?? '-',
        };
      }

      const last = invoices[invoices.length - 1];
      cursor = { id: last.id, createdAt: last.createdAt };
    }
  }

  // ── Shared row shaping ───────────────────────────────────────────────────

  private enrichRow(invoice: RevenueInvoiceRow): EnrichedRow {
    return {
      status: invoice.status,
      paidAt: invoice.paidAt,
      paymentMethod: invoice.paymentMethod,
      tierId: invoice.pricingTier?.id ?? null,
      tierName: invoice.pricingTier?.name ?? null,
      programId: invoice.application.program?.id ?? invoice.application.programId,
      programName: invoice.application.program?.name ?? 'Unknown',
      brandId: invoice.application.program?.brandId ?? null,
      brandName: invoice.application.program?.brand?.name ?? 'Unknown',
      money: resolveInvoiceRevenue(invoice, invoice.application.program?.usdInIdr ?? null),
    };
  }

  private toTransactionRow(invoice: RevenueInvoiceRow): RevenueTransactionRowDto {
    const money = resolveInvoiceRevenue(invoice, invoice.application.program?.usdInIdr ?? null);
    return {
      invoiceId: invoice.id,
      applicationId: invoice.applicationId,
      programId: invoice.application.program?.id ?? invoice.application.programId,
      programName: invoice.application.program?.name ?? 'Unknown',
      participantName: invoice.application.participant?.fullName ?? null,
      grossAmount: this.toNumber(invoice.amount),
      currency: invoice.currency,
      feeIdr: money.isBackfilled ? Math.round(money.feeIdr) : null,
      netIdr: money.isBackfilled && money.netIdr !== undefined ? Math.round(money.netIdr) : null,
      paymentMethod: invoice.paymentMethod,
      status: invoice.status,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      createdAt: invoice.createdAt.toISOString(),
      externalTransactionId: invoice.externalTransactionId,
    };
  }

  private buildTransactionsWhere(
    query: RevenueTransactionsQueryDto,
    scope: RevenueAccessScope,
    extra: Prisma.ApplicationInvoiceWhereInput[] = [],
  ): Prisma.ApplicationInvoiceWhereInput {
    const conditions: Prisma.ApplicationInvoiceWhereInput[] = [
      buildInvoiceScopeWhere(scope, query.brandId),
      ...extra,
    ];

    if (query.status) conditions.push({ status: query.status });
    if (query.currency) conditions.push({ currency: { equals: query.currency, mode: 'insensitive' } });
    if (query.programId) conditions.push({ application: { programId: query.programId } });
    if (query.paymentMethod) conditions.push({ paymentMethod: query.paymentMethod });

    if (query.dateFrom || query.dateTo) {
      conditions.push({
        createdAt: {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: this.endOfDay(query.dateTo) } : {}),
        },
      });
    }

    if (query.paidFrom || query.paidTo) {
      conditions.push({
        paidAt: {
          ...(query.paidFrom ? { gte: new Date(query.paidFrom) } : {}),
          ...(query.paidTo ? { lte: this.endOfDay(query.paidTo) } : {}),
        },
      });
    }

    return { AND: conditions };
  }

  private endOfDay(dateStr: string): Date {
    const MS_DAY = 86399999; // matches getAdminProgramAnalytics's existing convention
    return new Date(new Date(dateStr).getTime() + MS_DAY);
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value) || 0;
  }

  // ── Aggregation builders ─────────────────────────────────────────────────

  private buildKpis(rows: EnrichedRow[]): RevenueKpisDto {
    let grossIdr = 0;
    let grossUsd = 0;
    let feeIdr = 0;
    let netIdr = 0;
    let netUsd = 0;
    let unbackfilledCount = 0;
    let paidCount = 0;
    let processingCount = 0;
    let unpaidCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    let refundedCount = 0;

    for (const row of rows) {
      switch (row.status) {
        case PaymentStatus.paid:
          paidCount += 1;
          break;
        case PaymentStatus.processing:
          processingCount += 1;
          break;
        case PaymentStatus.unpaid:
          unpaidCount += 1;
          break;
        case PaymentStatus.failed:
          failedCount += 1;
          break;
        case PaymentStatus.cancelled:
          cancelledCount += 1;
          break;
        case PaymentStatus.refunded:
          refundedCount += 1;
          break;
      }

      if (row.status !== PaymentStatus.paid) continue; // revenue figures only count settled/paid invoices

      if (row.money.grossIdr !== undefined) grossIdr += row.money.grossIdr;
      if (row.money.grossUsd !== undefined) grossUsd += row.money.grossUsd;
      feeIdr += row.money.feeIdr;
      if (row.money.netIdr !== undefined) netIdr += row.money.netIdr;
      if (row.money.netUsd !== undefined) netUsd += row.money.netUsd;
      if (!row.money.isBackfilled) unbackfilledCount += 1;
    }

    // Collection rate = paid / (paid + unpaid + failed). processing/cancelled/refunded are
    // deliberately excluded from the denominator: "processing" hasn't resolved yet, and
    // cancelled/refunded represent abandoned or reversed intents, not outstanding collectible amounts.
    const collectionDenominator = paidCount + unpaidCount + failedCount;
    const collectionRate =
      collectionDenominator > 0 ? Number(((paidCount / collectionDenominator) * 100).toFixed(1)) : 0;

    return {
      grossIdr: Math.round(grossIdr),
      grossUsd: Number(grossUsd.toFixed(2)),
      feeIdr: Math.round(feeIdr),
      netIdr: Math.round(netIdr),
      netUsd: Number(netUsd.toFixed(2)),
      paidCount,
      processingCount,
      unpaidCount,
      failedCount,
      cancelledCount,
      refundedCount,
      collectionRate,
      unbackfilledCount,
    };
  }

  private buildRevenueByMonth(rows: EnrichedRow[]): RevenueByMonthItemDto[] {
    const now = new Date();
    return Array.from({ length: REVENUE_BY_MONTH_WINDOW }, (_, idx) => {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (REVENUE_BY_MONTH_WINDOW - 1 - idx), 1),
      );
      const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

      let grossIdr = 0;
      let feeIdr = 0;
      let netIdr = 0;
      for (const row of rows) {
        if (row.status !== PaymentStatus.paid || !row.paidAt) continue;
        if (row.paidAt < start || row.paidAt >= next) continue;
        if (row.money.grossIdr !== undefined) grossIdr += row.money.grossIdr;
        feeIdr += row.money.feeIdr;
        if (row.money.netIdr !== undefined) netIdr += row.money.netIdr;
      }

      return { label, grossIdr: Math.round(grossIdr), feeIdr: Math.round(feeIdr), netIdr: Math.round(netIdr) };
    });
  }

  private buildByPaymentMethod(rows: EnrichedRow[]): RevenueByPaymentMethodItemDto[] {
    const map = new Map<string, { grossIdr: number; count: number }>();
    for (const row of rows) {
      if (row.status !== PaymentStatus.paid) continue;
      const method = row.paymentMethod ?? 'unknown';
      const entry = map.get(method) ?? { grossIdr: 0, count: 0 };
      entry.grossIdr += row.money.grossIdr ?? 0;
      entry.count += 1;
      map.set(method, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([method, value]) => ({ method, grossIdr: Math.round(value.grossIdr), count: value.count }));
  }

  private buildByTier(rows: EnrichedRow[]): RevenueByTierItemDto[] {
    const map = new Map<string, { tierName: string; grossIdr: number; count: number }>();
    for (const row of rows) {
      if (row.status !== PaymentStatus.paid) continue;
      const tierId = row.tierId ?? 'unknown';
      const entry = map.get(tierId) ?? { tierName: row.tierName ?? 'Unknown', grossIdr: 0, count: 0 };
      entry.grossIdr += row.money.grossIdr ?? 0;
      entry.count += 1;
      map.set(tierId, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([tierId, value]) => ({
        tierId,
        tierName: value.tierName,
        grossIdr: Math.round(value.grossIdr),
        count: value.count,
      }));
  }

  private buildByProgram(rows: EnrichedRow[]): RevenueByProgramItemDto[] {
    const map = new Map<string, { programName: string; grossIdr: number; netIdr: number; paidCount: number }>();
    for (const row of rows) {
      if (row.status !== PaymentStatus.paid) continue;
      const entry = map.get(row.programId) ?? {
        programName: row.programName,
        grossIdr: 0,
        netIdr: 0,
        paidCount: 0,
      };
      entry.grossIdr += row.money.grossIdr ?? 0;
      entry.netIdr += row.money.netIdr ?? 0;
      entry.paidCount += 1;
      map.set(row.programId, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].grossIdr - a[1].grossIdr)
      .map(([programId, value]) => ({
        programId,
        programName: value.programName,
        grossIdr: Math.round(value.grossIdr),
        netIdr: Math.round(value.netIdr),
        paidCount: value.paidCount,
      }));
  }

  private buildByBrand(rows: EnrichedRow[]): RevenueByBrandItemDto[] {
    const map = new Map<string, { brandName: string; grossIdr: number; netIdr: number; paidCount: number }>();
    for (const row of rows) {
      if (row.status !== PaymentStatus.paid || !row.brandId) continue;
      const entry = map.get(row.brandId) ?? { brandName: row.brandName, grossIdr: 0, netIdr: 0, paidCount: 0 };
      entry.grossIdr += row.money.grossIdr ?? 0;
      entry.netIdr += row.money.netIdr ?? 0;
      entry.paidCount += 1;
      map.set(row.brandId, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].grossIdr - a[1].grossIdr)
      .map(([brandId, value]) => ({
        brandId,
        brandName: value.brandName,
        grossIdr: Math.round(value.grossIdr),
        netIdr: Math.round(value.netIdr),
        paidCount: value.paidCount,
      }));
  }
}
