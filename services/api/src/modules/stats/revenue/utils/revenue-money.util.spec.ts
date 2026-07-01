// src/modules/stats/revenue/utils/revenue-money.util.spec.ts
import { Prisma } from '@prisma/client';
import { resolveInvoiceRevenue } from './revenue-money.util';

describe('resolveInvoiceRevenue', () => {
  it('uses amountIdr snapshot directly for an IDR invoice, no rate needed', () => {
    const result = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('1500000'),
        currency: 'IDR',
        amountUsd: new Prisma.Decimal('100'),
        amountIdr: new Prisma.Decimal('1500000'),
        exchangeRateSnapshot: null,
        feeProvider: new Prisma.Decimal('30000'),
        netAmount: new Prisma.Decimal('1470000'),
      },
      null,
    );

    expect(result.grossIdr).toBe(1500000);
    expect(result.grossUsd).toBe(100);
    expect(result.feeIdr).toBe(30000);
    expect(result.netIdr).toBe(1470000);
    expect(result.isBackfilled).toBe(true);
  });

  it('falls back to invoice.exchangeRateSnapshot when amountIdr snapshot is missing (USD invoice)', () => {
    const result = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('100'),
        currency: 'USD',
        amountUsd: null,
        amountIdr: null,
        exchangeRateSnapshot: new Prisma.Decimal('15800'),
        feeProvider: null,
        netAmount: null,
      },
      16000, // program rate should be ignored — snapshot takes priority
    );

    expect(result.grossIdr).toBe(1580000);
    expect(result.grossUsd).toBe(100);
  });

  it('falls back to the program usdInIdr rate when exchangeRateSnapshot is null', () => {
    const result = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('100'),
        currency: 'USD',
        amountUsd: null,
        amountIdr: null,
        exchangeRateSnapshot: null,
        feeProvider: null,
        netAmount: null,
      },
      new Prisma.Decimal('15750'),
    );

    expect(result.grossIdr).toBe(1575000);
  });

  it('excludes the invoice from IDR/USD aggregation when no rate is resolvable anywhere (never assumes a rate)', () => {
    const result = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('100'),
        currency: 'USD',
        amountUsd: null,
        amountIdr: null,
        exchangeRateSnapshot: null,
        feeProvider: null,
        netAmount: null,
      },
      null,
    );

    expect(result.grossIdr).toBeUndefined();
    expect(result.grossUsd).toBe(100); // USD side is still resolvable from the raw amount
  });

  it('treats netAmount NULL as "prefer gross over guessed net" (fee assumed 0) and flags isBackfilled=false', () => {
    const result = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('1000000'),
        currency: 'IDR',
        amountUsd: null,
        amountIdr: new Prisma.Decimal('1000000'),
        exchangeRateSnapshot: null,
        feeProvider: null,
        netAmount: null,
      },
      null,
    );

    expect(result.feeIdr).toBe(0);
    expect(result.netIdr).toBe(1000000); // falls back to gross, not a guessed fee
    expect(result.isBackfilled).toBe(false);
  });

  it('is backfilled only when BOTH feeProvider and netAmount are populated', () => {
    const onlyFee = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('1000000'),
        currency: 'IDR',
        amountUsd: null,
        amountIdr: new Prisma.Decimal('1000000'),
        exchangeRateSnapshot: null,
        feeProvider: new Prisma.Decimal('20000'),
        netAmount: null,
      },
      null,
    );
    expect(onlyFee.isBackfilled).toBe(false);

    const both = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('1000000'),
        currency: 'IDR',
        amountUsd: null,
        amountIdr: new Prisma.Decimal('1000000'),
        exchangeRateSnapshot: null,
        feeProvider: new Prisma.Decimal('20000'),
        netAmount: new Prisma.Decimal('980000'),
      },
      null,
    );
    expect(both.isBackfilled).toBe(true);
  });

  it('derives netUsd proportionally from grossUsd and feeUsd using the resolved rate', () => {
    const result = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('1600000'),
        currency: 'IDR',
        amountUsd: null,
        amountIdr: new Prisma.Decimal('1600000'),
        exchangeRateSnapshot: new Prisma.Decimal('16000'),
        feeProvider: new Prisma.Decimal('32000'), // 2 USD worth of fee at rate 16000
        netAmount: new Prisma.Decimal('1568000'),
      },
      null,
    );

    expect(result.grossUsd).toBe(100);
    expect(result.netUsd).toBe(98); // 100 - (32000/16000)
  });

  it('leaves netUsd undefined when no rate is resolvable', () => {
    const result = resolveInvoiceRevenue(
      {
        amount: new Prisma.Decimal('1000000'),
        currency: 'IDR',
        amountUsd: null,
        amountIdr: new Prisma.Decimal('1000000'),
        exchangeRateSnapshot: null,
        feeProvider: new Prisma.Decimal('20000'),
        netAmount: new Prisma.Decimal('980000'),
      },
      null,
    );

    expect(result.grossUsd).toBeUndefined();
    expect(result.netUsd).toBeUndefined();
  });
});
