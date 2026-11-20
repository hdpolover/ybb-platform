// src/modules/users/application/queries/handlers/get-deletion-insights.handler.spec.ts
import { GetDeletionInsightsHandler } from './get-deletion-insights.handler';
import { GetDeletionInsightsQuery } from '../get-deletion-insights.query';

// Tagged-template calls hand the mock (strings[], ...values), not a Sql object.
const sqlText = (q: unknown) => (q as string[]).join('?');

const listRow = (over: Record<string, unknown>) => ({
  id: 'r1',
  status: 'approved',
  reason: null,
  reason_category: null,
  created_at: new Date('2026-11-01T00:00:00Z'),
  scheduled_deletion_date: new Date('2026-12-01T00:00:00Z'),
  actual_deletion_date: null,
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  brand_name: 'YBB',
  ...over,
});

function build(rows: Record<string, unknown>[], total = rows.length) {
  const queryRaw = jest.fn().mockImplementation(async (q: unknown) => {
    const text = sqlText(q);
    if (text.includes('FILTER')) {
      return [{ total: 10, last30: 4, pending_purge: 2, completed: 5, cancelled: 3 }];
    }
    if (text.includes('date_trunc')) return [{ month: '2026-10', count: 3 }, { month: '2026-11', count: 7 }];
    if (text.includes('COALESCE(r.reason_category')) return [{ key: 'not_given', count: 8 }, { key: 'cost', count: 2 }];
    if (text.includes('GROUP BY b.id')) return [{ brand_id: 'b1', brand_name: 'YBB', count: 10 }];
    if (text.includes('LIMIT')) return rows;
    return [{ count: total }]; // paged-list total
  });
  return { handler: new GetDeletionInsightsHandler({ $queryRaw: queryRaw } as never), queryRaw };
}

describe('GetDeletionInsightsHandler', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  it('returns totals with a cancellation rate', async () => {
    const { handler } = build([]);
    const res = await handler.execute(new GetDeletionInsightsQuery());
    expect(res.totals).toEqual({ all: 10, last30Days: 4, pendingPurge: 2, completed: 5, cancelled: 3, cancellationRate: 0.3 });
  });

  it('returns a zero cancellation rate with no requests', async () => {
    const queryRaw = jest.fn().mockImplementation(async (q: unknown) =>
      sqlText(q).includes('FILTER') ? [{ total: 0, last30: 0, pending_purge: 0, completed: 0, cancelled: 0 }] : [],
    );
    const res = await new GetDeletionInsightsHandler({ $queryRaw: queryRaw } as never).execute(new GetDeletionInsightsQuery());
    expect(res.totals.cancellationRate).toBe(0);
  });

  it('fills a 12-month series with zeros for empty months', async () => {
    const { handler } = build([]);
    const res = await handler.execute(new GetDeletionInsightsQuery());
    expect(res.monthly).toHaveLength(12);
    expect(res.monthly[0]).toEqual({ month: '2025-12', count: 0 });
    expect(res.monthly.slice(-2)).toEqual([{ month: '2026-10', count: 3 }, { month: '2026-11', count: 7 }]);
  });

  it('keys reasons and brands', async () => {
    const { handler } = build([]);
    const res = await handler.execute(new GetDeletionInsightsQuery());
    expect(res.byReason).toEqual([{ category: 'not_given', count: 8 }, { category: 'cost', count: 2 }]);
    expect(res.byBrand).toEqual([{ brandId: 'b1', brand: 'YBB', count: 10 }]);
  });

  describe('privacy', () => {
    it('shows identity for approved and cancelled rows', async () => {
      const { handler } = build([listRow({ status: 'approved' }), listRow({ id: 'r2', status: 'cancelled' })]);
      const res = await handler.execute(new GetDeletionInsightsQuery());
      expect(res.requests.items.map((i) => i.user)).toEqual([
        { name: 'Jane Doe', email: 'jane@example.com' },
        { name: 'Jane Doe', email: 'jane@example.com' },
      ]);
    });

    it('nulls identity for completed rows but keeps brand, reason and dates', async () => {
      const done = listRow({
        status: 'completed',
        reason: 'too many mails',
        reason_category: 'too_many_emails',
        actual_deletion_date: new Date('2026-11-15T00:00:00Z'),
        email: 'deleted+x@ybb.invalid',
        full_name: 'Deleted User',
      });
      const { handler } = build([done]);
      const [item] = (await handler.execute(new GetDeletionInsightsQuery())).requests.items;
      expect(item.user).toBeNull();
      expect(item).toMatchObject({ brand: 'YBB', reason: 'too many mails', reasonCategory: 'too_many_emails', status: 'completed' });
      expect(JSON.stringify(item)).not.toMatch(/Deleted User|ybb\.invalid|jane/i);
    });

    it('nulls identity for any status other than approved/cancelled', async () => {
      const { handler } = build([listRow({ status: 'pending' }), listRow({ id: 'r3', status: 'rejected' })]);
      const res = await handler.execute(new GetDeletionInsightsQuery());
      expect(res.requests.items.every((i) => i.user === null)).toBe(true);
    });

    it('never selects or returns data_snapshot, deletion_log or ip', async () => {
      const { handler, queryRaw } = build([listRow({ data_snapshot: { cancellationTokenHash: 'abc' }, deletion_log: { x: 1 }, ip_address: '1.2.3.4' })]);
      const res = await handler.execute(new GetDeletionInsightsQuery());
      expect(JSON.stringify(res)).not.toMatch(/cancellationTokenHash|deletion_log|1\.2\.3\.4|dataSnapshot/);
      const listSql = queryRaw.mock.calls.map(([q]) => sqlText(q)).find((t) => t.includes('LIMIT')) ?? '';
      expect(listSql).not.toMatch(/data_snapshot|deletion_log|ip_address/);
    });
  });

  it('rejects an unknown status filter', async () => {
    const { handler } = build([]);
    await expect(handler.execute(new GetDeletionInsightsQuery('nope'))).rejects.toThrow('Invalid status');
  });

  it('pages the list', async () => {
    const { handler } = build([listRow({})], 45);
    const res = await handler.execute(new GetDeletionInsightsQuery(undefined, 2, 20));
    expect(res.requests).toMatchObject({ page: 2, limit: 20, total: 45, lastPage: 3 });
  });
});
