// src/modules/users/application/queries/handlers/get-deletion-insights.handler.ts
import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DeletionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetDeletionInsightsQuery } from '../get-deletion-insights.query';

const MONTHS = 12;
const MAX_LIMIT = 100;
// Identity is only shown while the account still exists: in the grace period
// (approved) or kept (cancelled). After the purge it is anonymised anyway.
const IDENTITY_VISIBLE: ReadonlySet<string> = new Set([DeletionStatus.approved, DeletionStatus.cancelled]);

type TotalsRow = { total: number; last30: number; pending_purge: number; completed: number; cancelled: number };
type ListRow = {
  id: string;
  status: string;
  reason: string | null;
  reason_category: string | null;
  created_at: Date;
  scheduled_deletion_date: Date | null;
  actual_deletion_date: Date | null;
  email: string | null;
  full_name: string | null;
  brand_name: string | null;
};

/**
 * Read-only aggregate + paged list for the admin "Account deletions" screen.
 * Raw SQL: grouping by month/brand needs joins to users/brands, and users are
 * soft-deleted once purged, which the Prisma soft-delete extension would hide
 * (brand_id is not PII and must survive for the breakdown).
 *
 * Never selects data_snapshot (cancellation token hash), deletion_log
 * (firebase uids) or ip_address.
 */
@QueryHandler(GetDeletionInsightsQuery)
export class GetDeletionInsightsHandler implements IQueryHandler<GetDeletionInsightsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ status, page, limit }: GetDeletionInsightsQuery) {
    if (status && !(status in DeletionStatus)) throw new BadRequestException(`Invalid status "${status}"`);
    const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), MAX_LIMIT);
    const pageNum = Math.max(Math.trunc(page) || 1, 1);
    const where = status ? Prisma.sql`WHERE r.status::text = ${status}` : Prisma.empty;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    monthStart.setUTCMonth(monthStart.getUTCMonth() - (MONTHS - 1));

    const [[totals], monthlyRows, reasonRows, brandRows, listRows, [listTotal]] = await Promise.all([
      this.prisma.$queryRaw<TotalsRow[]>`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last30,
          COUNT(*) FILTER (WHERE status::text = 'approved')::int AS pending_purge,
          COUNT(*) FILTER (WHERE status::text = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status::text = 'cancelled')::int AS cancelled
        FROM account_deletion_requests`,
      this.prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM account_deletion_requests WHERE created_at >= ${monthStart} GROUP BY 1`,
      this.prisma.$queryRaw<{ key: string; count: number }[]>`
        SELECT COALESCE(r.reason_category, 'not_given') AS key, COUNT(*)::int AS count
        FROM account_deletion_requests r GROUP BY 1 ORDER BY count DESC`,
      this.prisma.$queryRaw<{ brand_id: string | null; brand_name: string | null; count: number }[]>`
        SELECT b.id::text AS brand_id, b.name AS brand_name, COUNT(*)::int AS count
        FROM account_deletion_requests r
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN brands b ON b.id = u.brand_id
        GROUP BY b.id, b.name ORDER BY count DESC`,
      this.prisma.$queryRaw<ListRow[]>`
        SELECT r.id::text AS id, r.status::text AS status, r.reason, r.reason_category, r.created_at,
          r.scheduled_deletion_date, r.actual_deletion_date, u.email, p.full_name, b.name AS brand_name
        FROM account_deletion_requests r
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN participants p ON p.user_id = r.user_id
        LEFT JOIN brands b ON b.id = u.brand_id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT ${take} OFFSET ${(pageNum - 1) * take}`,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM account_deletion_requests r ${where}`,
    ]);

    const all = totals?.total ?? 0;
    const cancelled = totals?.cancelled ?? 0;
    const total = listTotal?.count ?? 0;

    // Top-level keys deliberately avoid `items`/`data`: the global
    // TransformInterceptor would flatten them. Client reads `data.requests.items`.
    return {
      totals: {
        all,
        last30Days: totals?.last30 ?? 0,
        pendingPurge: totals?.pending_purge ?? 0,
        completed: totals?.completed ?? 0,
        cancelled,
        cancellationRate: all > 0 ? cancelled / all : 0,
      },
      monthly: fillMonths(monthlyRows),
      byReason: reasonRows.map((r) => ({ category: r.key, count: r.count })),
      byBrand: brandRows.map((r) => ({ brandId: r.brand_id, brand: r.brand_name, count: r.count })),
      requests: {
        items: listRows.map(toItem),
        page: pageNum,
        limit: take,
        total,
        lastPage: Math.max(Math.ceil(total / take), 1),
      },
    };
  }
}

function toItem(r: ListRow) {
  return {
    id: r.id,
    status: r.status,
    // null = "Deleted user": identity is dropped for every status but approved/cancelled.
    user: IDENTITY_VISIBLE.has(r.status) ? { name: r.full_name, email: r.email } : null,
    brand: r.brand_name,
    reasonCategory: r.reason_category,
    reason: r.reason,
    createdAt: r.created_at,
    scheduledDeletionDate: r.scheduled_deletion_date,
    actualDeletionDate: r.actual_deletion_date,
  };
}

function fillMonths(rows: { month: string; count: number }[]) {
  const counts = new Map(rows.map((r) => [r.month, r.count]));
  const now = new Date();
  return Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - i), 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { month, count: counts.get(month) ?? 0 };
  });
}
