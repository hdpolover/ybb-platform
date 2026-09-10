// src/modules/stats/revenue/dto/revenue-query.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MAX_REVENUE_PAGE_SIZE, RevenueTransactionsQueryDto } from './revenue-query.dto';

const validate = (query: Record<string, unknown>) =>
  validateSync(plainToInstance(RevenueTransactionsQueryDto, query, { enableImplicitConversion: true }));

describe('RevenueTransactionsQueryDto limit', () => {
  it('rejects a page size above the ceiling', () => {
    const errors = validate({ limit: MAX_REVENUE_PAGE_SIZE + 1 });

    expect(errors.map((e) => e.property)).toContain('limit');
  });

  it('accepts the ceiling itself and any smaller page', () => {
    expect(validate({ limit: MAX_REVENUE_PAGE_SIZE })).toHaveLength(0);
    expect(validate({ limit: 1 })).toHaveLength(0);
  });

  it('still rejects a page size below 1', () => {
    expect(validate({ limit: 0 }).map((e) => e.property)).toContain('limit');
  });
});
