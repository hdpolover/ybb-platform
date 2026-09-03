/**
 * Unit tests for RegistrationFeeMismatchesHandler.
 *
 * Covers the core reconciliation rule: a paid/processing registration_fee
 * invoice whose tier category no longer matches the application's current
 * category is a mismatch (with the right signed difference); an application
 * whose paid invoice still matches its current category is not.
 */

import { RegistrationFeeMismatchesHandler } from './registration-fee-mismatches.handler';
import { RegistrationFeeMismatchesQuery } from '../registration-fee-mismatches.query';

function buildInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invoice-1',
    status: 'paid',
    amount: 10,
    currency: 'USD',
    paidAt: new Date('2026-01-01T00:00:00.000Z'),
    pricingTier: { allowedCategories: ['fully_funded'] },
    application: {
      id: 'app-1',
      applicationCategory: 'fully_funded',
      participant: { fullName: 'Jane Doe', user: { email: 'jane@example.com' } },
    },
    ...overrides,
  };
}

describe('RegistrationFeeMismatchesHandler', () => {
  it('returns a mismatch with the signed difference when the paid tier no longer matches the current category', async () => {
    // App was paid under fully_funded ($10 tier) but is now self_funded (current tier $15).
    const invoice = buildInvoice({
      application: {
        id: 'app-1',
        applicationCategory: 'self_funded',
        participant: { fullName: 'Jane Doe', user: { email: 'jane@example.com' } },
      },
    });

    const prisma = {
      applicationInvoice: { findMany: jest.fn().mockResolvedValue([invoice]) },
      programPricingTier: {
        findMany: jest.fn().mockResolvedValue([
          { price: 10, currency: 'USD', allowedCategories: ['fully_funded'] },
          { price: 15, currency: 'USD', allowedCategories: ['self_funded'] },
        ]),
      },
    };

    const handler = new RegistrationFeeMismatchesHandler(prisma as never);
    const result = await handler.execute(new RegistrationFeeMismatchesQuery('prog-1', 20, 0));

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.applicationId).toBe('app-1');
    expect(row.currentCategory).toBe('self_funded');
    expect(row.invoicedCategory).toBe('fully_funded');
    expect(row.amountPaid).toBe(10);
    expect(row.currentTierPrice).toBe(15);
    // Owes the $5 gap between what they paid and the self_funded tier's current price.
    expect(row.difference).toBe(5);
  });

  it('excludes an application whose paid invoice still matches its current category', async () => {
    // Paid under fully_funded, still fully_funded — not a mismatch.
    const invoice = buildInvoice();

    const prisma = {
      applicationInvoice: { findMany: jest.fn().mockResolvedValue([invoice]) },
      programPricingTier: {
        findMany: jest.fn().mockResolvedValue([
          { price: 10, currency: 'USD', allowedCategories: ['fully_funded'] },
        ]),
      },
    };

    const handler = new RegistrationFeeMismatchesHandler(prisma as never);
    const result = await handler.execute(new RegistrationFeeMismatchesQuery('prog-1', 20, 0));

    expect(result.total).toBe(0);
    expect(result.rows).toHaveLength(0);
  });
});
