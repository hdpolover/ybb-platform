// src/modules/stats/revenue/dto/revenue-response.dto.ts

/** feeIdr/netIdr/netUsd are ESTIMATED — config-based estimates derived from
 * ApplicationInvoice.feeProvider/netAmount (mirrored from the Go payment service's
 * payment_transactions event payload), NOT settled gateway MDR figures. */
export interface RevenueKpisDto {
  grossIdr: number;
  grossUsd: number;
  /** ESTIMATED */
  feeIdr: number;
  /** ESTIMATED */
  netIdr: number;
  /** ESTIMATED */
  netUsd: number;
  paidCount: number;
  processingCount: number;
  unpaidCount: number;
  failedCount: number;
  cancelledCount: number;
  refundedCount: number;
  /** paidCount / (paidCount + unpaidCount + failedCount) * 100, rounded to 1 decimal.
   * Excludes processing/cancelled/refunded from the denominator — see RevenueService. */
  collectionRate: number;
  /** Count of paid invoices missing feeProvider/netAmount (fee/net not yet backfilled
   * for those rows; their contribution to feeIdr/netIdr/netUsd is an assumption of 0 fee). */
  unbackfilledCount: number;
}

export interface RevenueByMonthItemDto {
  label: string;
  grossIdr: number;
  /** ESTIMATED */
  feeIdr: number;
  /** ESTIMATED */
  netIdr: number;
}

export interface RevenueByPaymentMethodItemDto {
  method: string;
  grossIdr: number;
  count: number;
}

export interface RevenueByTierItemDto {
  tierId: string;
  tierName: string;
  grossIdr: number;
  count: number;
}

export class ProgramRevenueSummaryResponseDto {
  kpis: RevenueKpisDto;
  revenueByMonth: RevenueByMonthItemDto[];
  byPaymentMethod: RevenueByPaymentMethodItemDto[];
  byTier: RevenueByTierItemDto[];
}

export interface RevenueByProgramItemDto {
  programId: string;
  programName: string;
  grossIdr: number;
  /** ESTIMATED */
  netIdr: number;
  paidCount: number;
}

export interface RevenueByBrandItemDto {
  brandId: string;
  brandName: string;
  grossIdr: number;
  /** ESTIMATED */
  netIdr: number;
  paidCount: number;
}

export class PlatformRevenueRollupResponseDto {
  kpis: RevenueKpisDto;
  revenueByMonth: RevenueByMonthItemDto[];
  byProgram: RevenueByProgramItemDto[];
  byBrand: RevenueByBrandItemDto[];
}

export interface RevenueTransactionRowDto {
  invoiceId: string;
  applicationId: string;
  programId: string;
  programName: string;
  participantName: string | null;
  grossAmount: number;
  currency: string;
  /** ESTIMATED. null = not yet backfilled for this invoice. */
  feeIdr: number | null;
  /** ESTIMATED. null = not yet backfilled for this invoice. */
  netIdr: number | null;
  paymentMethod: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
  externalTransactionId: string | null;
}

/** Return type of RevenueService.getRevenueTransactions(). The controller spreads this
 * (data + flat pagination/summary fields) so the app's global TransformInterceptor produces
 * the wire envelope { statusCode, message, data, meta: { total, page, limit, totalPages, summary } }. */
export interface RevenueTransactionsResultDto {
  data: RevenueTransactionRowDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    /** Count of rows in the full filtered result set (not just this page) missing feeProvider/netAmount. */
    unbackfilledCount: number;
  };
}
