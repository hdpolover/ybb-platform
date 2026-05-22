export class ProgramAnalyticsResponseDto {
    participants: {
        funnel: Array<{ stage: string; count: number; pct: number }>;
        byCategory: Array<{ category: string; count: number; pct: number }>;
        byEducation: Array<{ level: string; count: number; pct: number }>;
        topInstitutions: Array<{ name: string; count: number }>;
    };
    payments: {
        kpis: {
            totalInvoices: number;
            paidCount: number;
            processingCount: number;
            unpaidCount: number;
            failedCount: number;
            cancelledCount: number;
            totalRevenueIdr: number;
            totalRevenueUsd: number;
            conversionRate: number;
        };
        revenueByMonth: Array<{ label: string; idr: number; usd: number }>;
        byTier: Array<{ name: string; paidCount: number; totalAmount: number; currency: string }>;
        byPaymentMethod: Array<{ method: string; count: number }>;
        countriesByStatus: Array<{ country: string; paid: number; processing: number; unpaid: number; failed: number; cancelled: number; total: number }>;
    };
}
